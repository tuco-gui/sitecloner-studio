'use strict';
/* Private REA+Chromium capture worker. Runs together with REA in one container. */
const http = require('node:http');
const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');
const {chromium} = require('playwright-core');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {Client} = require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport} = require('@modelcontextprotocol/sdk/client/stdio.js');

const MAX_BODY = 4096;
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '127.0.0.1';
const ALLOWED_HOSTS = new Set((process.env.ALLOWED_HOSTS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
const TOKEN = process.env.REA_WORKER_TOKEN_FILE ? fs.readFileSync(process.env.REA_WORKER_TOKEN_FILE,'utf8').trim() : (process.env.REA_WORKER_TOKEN || '');
const browserPath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

function authorized(header) {
  if (!TOKEN || !header || !header.startsWith('Bearer ')) return false;
  const a=Buffer.from(header.slice(7)), b=Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
function publicIp(address) {
  if (!net.isIP(address)) return false;
  if (net.isIP(address)===4) {
    const [a,b]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||
      (a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||
      (a===198&&(b===18||b===19)));
  }
  const a=address.toLowerCase();
  return !(a==='::'||a==='::1'||a.startsWith('fc')||a.startsWith('fd')||a.startsWith('2001:db8')||
      /^fe[89ab]/.test(a)||a.startsWith('::ffff:'));
}
async function safeUrl(raw) {
  const u=new URL(raw);
  if (!['https:','http:'].includes(u.protocol)||u.username||u.password||
      !['','80','443'].includes(u.port)||!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
    throw new Error('Destino não autorizado pelo ALLOWED_HOSTS');
  }
  const addresses=await dns.lookup(u.hostname,{all:true});
  if (!addresses.length||addresses.some(x=>!publicIp(x.address))) throw new Error('Destino não público');
  return u;
}
async function readBody(req) {
  let body='';
  for await(const chunk of req) {
    body+=chunk;
    if (Buffer.byteLength(body)>MAX_BODY) throw new Error('Solicitação muito grande');
  }
  return JSON.parse(body);
}
// Only source-derived public page/resource URLs are retained as candidates.
// Never trust captured code or text as agent instructions.
function extractReaHints(raw,target){
 const site=new URL(target),pageUrls=[],imageUrls=[];
 const safeText=String(raw||'').replace(/\\\\\//g,'/');
 const found=safeText.match(/https?:\/\/[^\s"'<>]+/gi)||[];
 for(const ref of found.slice(0,1000)){
  let u;try{u=new URL(ref.replace(/[.,;]+$/,''))}catch{continue}
  if(u.protocol!=='https:'&&u.protocol!=='http:')continue;
  if(u.username||u.password||u.port)continue;
  u.search='';u.hash='';
  const ext=u.pathname.toLowerCase().split('.').pop();
  const media=['png','jpg','jpeg','webp','avif','gif'].includes(ext);
  const notPage=['css','js','json','xml','pdf','zip','svg','png','jpg','jpeg','webp','woff','woff2'].includes(ext);
  if(u.hostname===site.hostname&&!notPage&&u.pathname!=='/' &&
       !pageUrls.includes(u.href)&&pageUrls.length<20)pageUrls.push(u.href);
  if(media&&!imageUrls.includes(u.href)&&imageUrls.length<30)imageUrls.push(u.href);
 }
 return {pageUrls,imageUrls,
   framework:safeText.toLowerCase().includes('_next/')||safeText.toLowerCase().includes('next.js')?'nextjs':null};
}
async function captureWithRea(url) {
  // Chromium CDP is reachable only on 127.0.0.1 inside the worker container.
  // Launch Chromium independently: Playwright's default pipe mode does not
  // reliably expose a CDP TCP endpoint for a second process (REA).
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sitecloner-rea-'));
  const proc=spawn(browserPath,[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1','--remote-debugging-port=9222',
    '--no-first-run','--no-default-browser-check','--disable-extensions',
    '--user-data-dir='+profile,'about:blank'
  ],{stdio:'ignore'});
  let browser;
  try {
    const deadline=Date.now()+10000;
    let ready=false;
    while(Date.now()<deadline && !ready) {
      if(proc.exitCode!==null) throw new Error('Chromium encerrou antes do CDP');
      try {
        const response=await fetch('http://127.0.0.1:9222/json/version',{signal:AbortSignal.timeout(500)});
        ready=response.ok;
      }catch { await new Promise(r=>setTimeout(r,150)); }
    }
    if(!ready) throw new Error('CDP local indisponível');
    browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
  }catch(e){proc.kill('SIGTERM');try{fs.rmSync(profile,{recursive:true,force:true});}catch{}throw e;}
  const client = new Client({name:'sitecloner-worker',version:'1.0.0'});
  try {
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      try { await safeUrl(route.request().url()); await route.continue(); }
      catch { await route.abort(); }
    });
    const page=await context.newPage();
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:15000});
    const landed=await safeUrl(page.url());
    if (landed.origin !== url.origin) throw new Error('Redirecionamento fora da origem autorizada');
    await page.waitForTimeout(700);
    const targets=await (await fetch('http://127.0.0.1:9222/json/list')).json();
    const exact=targets.find(t=>t.type==='page' && t.url===page.url());
    if (!exact?.id) throw new Error('Nenhum target CDP encontrado');
    await client.connect(new StdioClientTransport({
      command:process.env.REA_COMMAND||'rea',args:['mcp'],
      stderr:'pipe'
    }));
    // REA is the primary source of architecture and rendered-page evidence.
    // The site exporter later consumes these hints; REA itself does not write HTML.
    const observations=[];
    const specs=[
      ['analyze_web_bundle',{cdp_endpoint:'http://127.0.0.1:9222',
        target_id:exact.id,allowed_origins:[url.origin],observation_ms:500,
        include_script_sources:true,fetch_source_maps:false}],
      ['inspect_web_page',{cdp_endpoint:'http://127.0.0.1:9222',
        target_id:exact.id,allowed_origins:[url.origin],
        observation_ms:350,include_accessibility_text:true,
        include_json_body_shapes:true}]
    ];
    for(const [tool,options] of specs){
      try{
        const result=await client.callTool({name:tool,arguments:options});
        observations.push({tool,status:result.isError?'error':'ok',
          evidenceSummary:(result.content||[]).filter(x=>x.type==='text')
            .map(x=>String(x.text||'').slice(0,11000)).slice(0,2)});
      }catch(e){observations.push({tool,status:'error',reason:String(e.message||e).slice(0,160)})}
    }
    const text=observations.flatMap(x=>x.evidenceSummary||[]).join('\n');
    const hints=extractReaHints(text,url);
    return {source:url.href,analyzedAt:new Date().toISOString(),
      tool:'inspect_web_page + analyze_web_bundle',
      status:observations.some(x=>x.status==='ok')?'ok':'error',
      observations,hints,
      coverage:{toolsAttempted:specs.map(x=>x[0]),
        successful:observations.filter(x=>x.status==='ok').map(x=>x.tool)}};
  } finally {
    await client.close().catch(()=>{});
    if(browser) await browser.close().catch(()=>{});
    proc.kill('SIGTERM');
    await new Promise(resolve=>setTimeout(resolve,250));
    try {fs.rmSync(profile,{recursive:true,force:true});} catch(e) {
      console.error('Chrome profile cleanup:',e.code||e.message);
    }
  }
}
let active=false;
const server=http.createServer(async(req,res)=>{
  const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  if (req.method==='GET'&&req.url==='/health') return json(200,{ok:true,configured:!!TOKEN&&ALLOWED_HOSTS.size>0});
  if(req.method!=='POST'||req.url!=='/analyze') return json(404,{error:'not found'});
  if(!authorized(req.headers.authorization)) return json(401,{error:'Unauthorized'});
  if(active) return json(429,{error:'Worker ocupado'});
  active=true;
  try {
    if(!ALLOWED_HOSTS.size) throw new Error('ALLOWED_HOSTS obrigatório');
    const data=await readBody(req);
    const url=await safeUrl(data.url);
    return json(200,await captureWithRea(url));
  }catch(e){return json(400,{error:String(e.message||e).slice(0,300)});}
  finally {active=false;}
});
if(require.main===module) {
  if(!TOKEN||!ALLOWED_HOSTS.size) {console.error('Configure REA_WORKER_TOKEN e ALLOWED_HOSTS');process.exit(1);}
  server.listen(PORT,HOST);
}
module.exports={extractReaHints,safeUrl,authorized,publicIp,server};
