'use strict';
/* Dedicated reconstruction worker. Run one replica with a persistent volume.
   The model has no shell/exec access and only its bounded React source is compiled. */
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const crypto=require('node:crypto');
const {makeSpec,normalizedTarget}=require('../lib/ai-builder/spec');
const {generateWithModel,modelConfig,verifyModelAccess}=require('../lib/ai-builder/model');
const {normalizeProject,projectZip}=require('../lib/ai-builder/project');
const {compileProject}=require('../lib/ai-builder/compile');
const PORT=Number(process.env.PORT||8791),HOST=process.env.HOST||'127.0.0.1';
const ROOT=process.env.BUILDER_DATA_DIR||'/data/sitecloner-builder';
const readSecret=(key,file)=>file?fs.readFileSync(file,'utf8').trim():key||'';
const TOKEN=readSecret(process.env.BUILDER_WORKER_TOKEN,process.env.BUILDER_WORKER_TOKEN_FILE);
const REA_TOKEN=readSecret(process.env.REA_WORKER_TOKEN,process.env.REA_WORKER_TOKEN_FILE);
const MODEL_KEY=readSecret(process.env.BUILDER_MODEL_API_KEY,process.env.BUILDER_MODEL_API_KEY_FILE);
const configured=()=>Boolean(TOKEN&&REA_TOKEN&&process.env.REA_WORKER_URL&&modelConfig({...process.env,BUILDER_MODEL_API_KEY:MODEL_KEY}));
let lastAccess={until:0,ready:false};
async function builderReady(){
 if(!configured())return false;
 if(lastAccess.until>Date.now())return lastAccess.ready;
 const ready=await verifyModelAccess(modelConfig({...process.env,BUILDER_MODEL_API_KEY:MODEL_KEY}));
 lastAccess={until:Date.now()+30000,ready};
 return ready;
}
const jobs=new Map(),queue=[];let running=false;
const validId=id=>/^[0-9a-f-]{36}$/.test(id||'');
const directory=id=>path.join(ROOT,id);
const publicJob=j=>({id:j.id,source:j.source,kind:j.kind,designMode:j.designMode,status:j.status,createdAt:j.createdAt,updatedAt:j.updatedAt,summary:j.summary||null,limitations:j.limitations||[],error:j.error||null,usage:j.usage||null});
function authorized(header){
 if(!TOKEN||typeof header!=='string'||!header.startsWith('Bearer '))return false;
 const a=Buffer.from(header.slice(7)),b=Buffer.from(TOKEN);
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
async function store(job){
 job.updatedAt=new Date().toISOString();
 const dir=directory(job.id);
 await fsp.mkdir(dir,{recursive:true,mode:0o700});
 const tmp=path.join(dir,'status-'+crypto.randomUUID()+'.tmp');
 await fsp.writeFile(tmp,JSON.stringify(job),{mode:0o600});
 await fsp.rename(tmp,path.join(dir,'status.json'));
 jobs.set(job.id,job);
}
async function stage(job,status){
 job.status=status;await store(job);
}
async function analyze(source){
 const endpoint=new URL(process.env.REA_WORKER_URL||'');
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error('REA exige HTTPS');
 const dest=new URL(endpoint.pathname.replace(/\/$/,'')+'/analyze',endpoint.origin);
 const res=await fetch(dest,{method:'POST',redirect:'error',signal:AbortSignal.timeout(50000),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+REA_TOKEN},
  body:JSON.stringify({url:source})});
 if(!res.ok)throw Error('REA indisponível (HTTP '+res.status+')');
 const raw=await res.text();if(raw.length>100000)throw Error('Relatório REA excedeu o limite');
 return JSON.parse(raw);
}
async function analyzeSite(source){
 const first=await analyze(source);
 if(first.status!=='ok')return first;
 const origin=new URL(source).origin;
 const hints=first.hints||{pageUrls:[],imageUrls:[]};
 const candidates=(hints.pageUrls||[]).filter(u=>{try{return new URL(u).origin===origin&&u!==source}catch{return false}}).slice(0,2);
 const observations=[...(first.observations||[])];
 const pages=[source];
 const images=new Set(hints.imageUrls||[]);
 const urls=new Set(hints.pageUrls||[]);
 for(const url of candidates){
  try{
   const next=await analyze(url);
   if(next.status!=='ok')continue;
   pages.push(url);
   for(const observation of (next.observations||[]).filter(x=>x.status==='ok').slice(0,2)){
    observations.push({...observation,pageUrl:url});
   }
   for(const x of (next.hints?.imageUrls||[]))if(images.size<45)images.add(x);
   for(const x of (next.hints?.pageUrls||[]))if(urls.size<45)urls.add(x);
  }catch{}
 }
 return {...first,observations,hints:{...hints,pageUrls:[...urls],imageUrls:[...images]},pagesInspected:pages};
}
async function execute(job){
 try{
  await stage(job,'investigating');
  const rea=await analyzeSite(job.source);
  await stage(job,'specifying');
  const spec=makeSpec({url:job.source,kind:job.kind,designMode:job.designMode,instructions:job.instructions},rea);
  await fsp.writeFile(path.join(directory(job.id),'site-spec.json'),JSON.stringify(spec,null,2),{mode:0o600});
  await stage(job,'generating');
  const config=modelConfig({...process.env,BUILDER_MODEL_API_KEY:MODEL_KEY});
  let generated=await generateWithModel(spec,config);
  let project,preview;
  const usage=[generated.usage];
  for(let attempt=0;attempt<3;attempt++){
   try{
    project=normalizeProject(generated.output,spec);
    await stage(job,'compiling');
    preview=await compileProject(project);
    break;
   }catch(e){
    if(attempt===2)throw Error('Falha na compilação após reparos: '+String(e.message||e).slice(0,200));
    await stage(job,'repairing');
    generated=await generateWithModel(spec,config,fetch,{
      compilerError:String(e.message||e),
      previousProject:generated.output
    });
    usage.push(generated.usage);
   }
  }
  await stage(job,'packaging');
  const {buffer,sha256}=await projectZip(project,preview);
  await fsp.writeFile(path.join(directory(job.id),'project.zip'),buffer,{mode:0o600,flag:'wx'});
  job.sha256=sha256;job.summary=project.summary;job.limitations=project.limitations;
  job.usage=usage;job.error=null;
  await stage(job,'ready');
 }catch(e){
  job.error=String(e?.message||e).slice(0,280);
  await stage(job,'failed');
 }
}
async function drain(){
 if(running)return;running=true;
 try{while(queue.length){const id=queue.shift(),job=jobs.get(id);if(job&&job.status==='queued')await execute(job);}}
 finally{running=false}
}
async function load(){
 await fsp.mkdir(ROOT,{recursive:true,mode:0o700});
 for(const item of (await fsp.readdir(ROOT,{withFileTypes:true})).filter(x=>x.isDirectory()).slice(0,250)){
  if(!validId(item.name))continue;
  try{
   const j=JSON.parse(await fsp.readFile(path.join(ROOT,item.name,'status.json'),'utf8'));
   if(j.id!==item.name)continue;
   if(['queued','investigating','specifying','generating','compiling','repairing','packaging'].includes(j.status)){
    j.status='failed';j.error='Trabalho interrompido. Reenvie para iniciar novamente.';await store(j);
   }else jobs.set(j.id,j);
  }catch{}
 }
}
async function readJson(req){
 let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>10000)throw Error('Solicitação muito grande')}
 return JSON.parse(raw);
}
const server=http.createServer(async(req,res)=>{
 const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
 if(req.url==='/health'&&req.method==='GET')return json(200,{ok:true,ready:await builderReady(),queue:queue.length,busy:running});
 if(!authorized(req.headers.authorization))return json(401,{error:'Unauthorized'});
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(req.method==='POST'&&pathname==='/jobs'){
  if(!(await builderReady()))return json(503,{error:'Agente IA indisponível ou combo do 9Router não encontrado'});
  if(running&&queue.length>=5)return json(429,{error:'Fila cheia'});
  try{
   const body=await readJson(req);const source=normalizedTarget(body.url);
   if(!['site','ecommerce','webapp'].includes(body.kind)||!['faithful','redesign'].includes(body.designMode))return json(400,{error:'Parâmetros inválidos'});
   const job={id:crypto.randomUUID(),source,kind:body.kind,designMode:body.designMode,instructions:String(body.instructions||'').slice(0,1500),status:'queued',createdAt:new Date().toISOString()};
   await store(job);queue.push(job.id);void drain();
   return json(202,publicJob(job));
  }catch(e){return json(400,{error:String(e.message).slice(0,180)})}
 }
 const match=/^\/jobs\/([a-f0-9-]{36})(\/artifact)?$/.exec(pathname);
 if(match&&req.method==='GET'){
  const id=match[1];if(!validId(id)||!jobs.has(id))return json(404,{error:'Trabalho não encontrado'});
  const job=jobs.get(id);
  if(!match[2])return json(200,publicJob(job));
  if(job.status!=='ready')return json(409,{error:'Projeto ainda não está pronto'});
  try{
   const file=await fsp.readFile(path.join(directory(id),'project.zip'));
   res.writeHead(200,{'Content-Type':'application/zip','Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="sitecloner-ai-project.zip"'});
   return res.end(file);
  }catch{return json(404,{error:'Arquivo não encontrado'})}
 }
 return json(404,{error:'Not found'});
});
if(require.main===module){
 load().then(()=>server.listen(PORT,HOST)).catch(e=>{console.error('builder startup:',e.message);process.exit(1)});
}
module.exports={server,load,authorized,publicJob};
