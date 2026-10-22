const {checkSession,validOrigin}=require('../lib/session-auth');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!checkSession(req))return res.status(401).json({error:'Faça login'});
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método não permitido'});
 const endpoint=process.env.BUILDER_WORKER_URL;
 const secret=process.env.BUILDER_WORKER_TOKEN;
 const enabled=Boolean(endpoint&&secret);
 if(req.method==='GET'&&!req.query?.id){
  if(!enabled)return res.status(200).json({enabled:false,reason:'Agente IA não configurado'});
  try{
   const u=new URL(endpoint);
   if(u.protocol!=='https:')throw Error('URL inválida');
   const r=await fetch(new URL(u.pathname.replace(/\/$/,'')+'/health',u.origin),{signal:AbortSignal.timeout(4000)});
   if(!r.ok)throw Error('Worker offline');
   const h=await r.json();
   return res.status(200).json({enabled:!!h.ready,reason:h.ready?null:'Conecte o modelo de IA no worker'});
  }catch{return res.status(200).json({enabled:false,reason:'Serviço de reconstrução indisponível'})}
 }
 if(!enabled)return res.status(503).json({error:'Agente IA não configurado'});
 if(req.method==='POST'&&!validOrigin(req))return res.status(403).json({error:'Origem não autorizada'});
 try{
  const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password)throw Error('Endpoint interno inválido');
  const id=req.query?.id;
  if(id&&!/^[0-9a-f-]{36}$/.test(id))return res.status(400).json({error:'ID inválido'});
  const suffix=id?'/jobs/'+id+(req.query?.download==='1'?'/artifact':''):'/jobs';
  if(req.method==='POST'&&id)return res.status(405).json({error:'Método não permitido'});
  if(req.method==='GET'&&!id)return res.status(400).json({error:'Informe o ID'});
  const url=new URL(u.pathname.replace(/\/$/,'')+suffix,u.origin);
  const response=await fetch(url,{method:req.method,redirect:'error',signal:AbortSignal.timeout(req.method==='POST'?12000:20000),
   headers:{Authorization:'Bearer '+secret,...(req.method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(req.method==='POST'?{body:JSON.stringify({url:req.body?.url,kind:req.body?.kind,designMode:req.body?.designMode,instructions:req.body?.instructions})}:{})});
  if(req.query?.download==='1'&&response.ok){
   const content=Buffer.from(await response.arrayBuffer());
   if(content.length>30*1024*1024)throw Error('Projeto excede 30MB');
   res.setHeader('Content-Type','application/zip');
   res.setHeader('Content-Disposition','attachment; filename="sitecloner-ai-project.zip"');
   return res.status(200).send(content);
  }
  const result=await response.json();
  return res.status(response.status).json(result);
 }catch(e){return res.status(502).json({error:'Reconstrução temporariamente indisponível'})}
};
module.exports.config={maxDuration:30};
