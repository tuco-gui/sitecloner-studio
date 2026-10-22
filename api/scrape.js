const {checkSession,validOrigin}=require('../lib/session-auth');
const {css: redesignCss,redesign}=require('../lib/redesign');
const { chromium: playwright } = require('playwright-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const JSZip = require('jszip');
const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');

const PAGE_LIMIT = 10;
const ASSET_LIMIT = 100;
const ASSET_MAX = 3 * 1024 * 1024;
const ZIP_MAX = 30 * 1024 * 1024;
const DEADLINE = 52000;
module.exports.config = { maxDuration: 60 };

function isPrivate(address) {
  const kind = net.isIP(address);
  if (kind === 4) {
    const [a,b] = address.split('.').map(Number);
    return a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) ||
      (a===172&&b>=16&&b<=31) || (a===192&&b===168) ||
      (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19)) ||
      (a===192&&(b===0||b===88)) || (a===169&&b===253);
  }
  if (kind === 6) {
    const n=address.toLowerCase();
    if (n.startsWith('::ffff:')) return true;
    return n==='::' || n==='::1' || n.startsWith('fc') || n.startsWith('fd') ||
      /^fe[89ab]/.test(n) || n.startsWith('2001:db8');
  }
  return true;
}
async function checkUrl(value, origin) {
  let u;
  try { u = new URL(value); } catch { throw new Error('URL inválida'); }
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password ||
    !['','80','443'].includes(u.port) || u.hostname==='localhost' ||
    u.hostname.endsWith('.local') || u.hostname.endsWith('.internal')) throw new Error('URL não permitida');
  if (origin && u.origin !== origin) throw new Error('Destino fora do domínio autorizado');
  const addrs = await dns.lookup(u.hostname,{all:true});
  if (!addrs.length || addrs.some(a=>isPrivate(a.address))) throw new Error('Endereço IP interno ou reservado');
  return u;
}
function safeName(u, fallback) {
  const ext=(new URL(u).pathname.split('/').pop()||'').match(/\.([a-z0-9]{1,6})$/i)?.[1]?.toLowerCase();
  const type=ext && ['css','js','png','jpg','jpeg','gif','webp','svg','woff','woff2','ico','avif','json'].includes(ext)?ext:fallback;
  return 'assets/'+crypto.createHash('sha256').update(u).digest('hex').slice(0,18)+'.'+type;
}
function pathForPage(u, index) {
  return index===0?'index.html':'pages/pagina-'+(index+1)+'.html';
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  if(!checkSession(req)) return res.status(401).json({error:'Faça login para capturar.'});
  if(!validOrigin(req)) return res.status(403).json({error:'Origem não autorizada'});
  let browser;
  try {
    const entry=await checkUrl(req.body?.url);
    const designMode=req.body?.designMode==='redesign'?'redesign':'faithful';
    const maximumPages=Math.max(1,Math.min(PAGE_LIMIT,Number(req.body?.maxPages)||PAGE_LIMIT));

    if (req.body?.mode !== 'advanced') {
      const zip = new JSZip();
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),14000);
      try {
        let next=entry, response;
        for(let redirect=0;redirect<4;redirect++){
          await checkUrl(next.href);
          response=await fetch(next.href,{signal:controller.signal,redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 SiteCloner Studio','Accept':'text/html'}});
          if([301,302,303,307,308].includes(response.status)){
            next=await checkUrl(new URL(response.headers.get('location'),next).href);
            continue;
          }
          break;
        }
        if(!response?.ok)throw new Error('HTTP '+(response?.status||'sem resposta'));
        if(!/text\/html/i.test(response.headers.get('content-type')||''))throw new Error('A resposta não é HTML');
        const length=Number(response.headers.get('content-length')||0);
        if(length>2000000)throw new Error('HTML ultrapassa 2 MB');
        const text=await response.text();
        if(text.length>2000000)throw new Error('HTML ultrapassa 2 MB');
        const $=cheerio.load(text);
        $('base,meta[http-equiv="refresh"]').remove();
        $('script,iframe,object,embed').remove();
        $('*').each((_,el)=>{
          for(const key of Object.keys(el.attribs||{})){
            if(key.toLowerCase().startsWith('on'))$(el).removeAttr(key);
            if(['href','src','poster'].includes(key)){
              const val=$(el).attr(key);
              try {
                const absolute=new URL(val,next).href;
                if(/^https?:/.test(absolute))$(el).attr(key,absolute);
                else $(el).removeAttr(key);
              }catch {$(el).removeAttr(key)}
            }
          }
        });
        const output='<!DOCTYPE html>\n'+$.html();
        zip.file('index.html',designMode==='redesign'?redesign(output):output);
        if(designMode==='redesign')zip.file('sitecloner-redesign.css',redesignCss);
        zip.file('captura.json',JSON.stringify({source:next.href,createdAt:new Date().toISOString(),pages:[{url:next.href,file:'index.html',title:$('title').text().slice(0,150)}],assetsSaved:0,assetErrors:[],designMode,mode:'basic',limitations:['Captura básica sem navegador: CSS e imagens permanecem como referências externas','Para captura avançada selecione Playwright; recursos de sites protegidos podem falhar']},null,2));
        const payload=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
        res.setHeader('Content-Type','application/zip');
        res.setHeader('Content-Disposition','attachment; filename="sitecloner-basico.zip"');
        return res.status(200).send(payload);
      } finally {clearTimeout(timeout);}
    }

    const origin=entry.origin;
    const zip=new JSZip();
    const start=Date.now();
    let bytes=0;
    const assets=new Map(), discovered=[], visited=new Set(), reports=[];
    const captured=new Map();
    let firstHtml='';
    browser=await playwright.launch({
      executablePath:await chromium.executablePath(),
      headless:true,
      args:chromium.args
    });
    const context=await browser.newContext({ignoreHTTPSErrors:false,serviceWorkers:'block',acceptDownloads:false});
    const validatedHosts = new Set([entry.hostname]);
    await context.route('**/*', async route=>{
      const raw=route.request().url();
      try {
        const u=new URL(raw);
        if(u.protocol==='data:' || u.protocol==='blob:' || u.protocol==='about:') return route.continue();
        if (!validatedHosts.has(u.hostname)) { await checkUrl(raw); validatedHosts.add(u.hostname); }
        if(Date.now()-start>DEADLINE) return route.abort();
        return route.continue();
      } catch { return route.abort(); }
    });
    const page=await context.newPage();
    page.setDefaultTimeout(10000);
    const queue=[entry.href];
    // Seed supplementary URLs from sitemap (when available), while still
    // preferring links found on the home page. Do not follow external hosts.
    let sitemapUrls=[];
    try {
      const sitemap=new URL('/sitemap.xml',entry);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
      try{
        await checkUrl(sitemap.href,origin);
        const response=await fetch(sitemap.href,{signal:controller.signal,redirect:'manual'});
        if(response.ok && /xml|text\/plain/i.test(response.headers.get('content-type')||'') &&
          Number(response.headers.get('content-length')||0)<750000){
          const body=await response.text();
          if(body.length<750000){
            sitemapUrls=[...body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].slice(0,100).map(x=>x[1].replace(/&amp;/g,'&'))
              .filter(x=>{try{const u=new URL(x);return u.origin===origin&&u.pathname!=='/'}catch{return false}});
          }
        }
      }finally{clearTimeout(timer)}
    }catch{}
    while(queue.length && reports.filter(x=>x.file).length<maximumPages && Date.now()-start<DEADLINE-8000) {
      const target=queue.shift();
      const normalized=target.split('#')[0];
      if(visited.has(normalized)) continue;
      visited.add(normalized);
      let response;
      try {
        response=await page.goto(normalized,{waitUntil:'domcontentloaded',timeout:16000});
        await page.waitForTimeout(1100);
        const current=await checkUrl(page.url(),origin);
        if(!response || !response.ok()) throw new Error('HTTP '+(response?.status()||'sem resposta'));
        const content=await page.content();
        const $=cheerio.load(content,{decodeEntities:false});
        $('base, meta[http-equiv="refresh"]').remove();
        $('script[src],link[href],img[src],source[src],video[poster]').each((_,el)=>{
          const name=el.name==='link'?'href':el.name==='video'?'poster':'src';
          const value=(el.name==='img'?($(el).attr('src')||$(el).attr('data-src')||$(el).attr('data-lazy-src')):$(el).attr(name));
          if(!value) return;
          try {
            const absolute=new URL(value,current).href;
            const u=new URL(absolute);
            if(!['http:','https:'].includes(u.protocol)) return;
            const fallback=el.name==='script'?'js':el.name==='link'?'css':'jpg';
            if(el.name==='link' && !(/stylesheet|icon/i.test($(el).attr('rel')||''))) return;
            const local=safeName(absolute,fallback);
            assets.set(absolute,local);
            $(el).attr(name,(reports.length===0?'':'../')+local);
          } catch {}
        });
        $('a[href]').each((_,el)=>{
          const href=$(el).attr('href');
          try {
            const next=new URL(href,current);
            next.hash='';
            if(next.origin!==origin || !['http:','https:'].includes(next.protocol))return;
            if(/\.(pdf|zip|png|jpe?g|svg|webp|gif|mp4|docx?)$/i.test(next.pathname))return;
            if(!visited.has(next.href) && !queue.includes(next.href) && queue.length<15)queue.push(next.href);
            // Link rewriting is performed after crawling, when actual saved pages
            // are known. Never guess filenames from queue positions here.
            $(el).attr('href',next.href);
          } catch{}
        });
        $('*').each((_,el)=>{
          for(const key of Object.keys(el.attribs||{})){
            if(key.toLowerCase().startsWith('on')) $(el).removeAttr(key);
          }
        });
        const html='<!DOCTYPE html>\n'+$.html();
        const index=reports.filter(x=>x.file).length;
        if(index===0)firstHtml=html;
        const file=pathForPage(current.href,index);
        zip.file(file,html);
        captured.set(current.href,file);
        reports.push({url:current.href,file,title:$('title').first().text().trim().slice(0,150)});
        if(index===0){for(const u of sitemapUrls){if(queue.length>=100)break;if(!queue.includes(u))queue.push(u)}}
      } catch(e) {
        reports.push({url:normalized,error:e.message});
      }
    }
    if(!firstHtml) throw new Error('Não foi possível capturar a primeira página');
    // Re-map anchors only to pages actually downloaded. Non-captured links
    // retain their remote destinations rather than pointing to nonexistent files.
    for(const [url,file] of captured){
      const html=await zip.file(file).async('string');
      const $=cheerio.load(html,{decodeEntities:false});
      $('a[href]').each((_,el)=>{
        const raw=$(el).attr('href');
        try {
          const absolute=new URL(raw,url);
          const fragment=absolute.hash;
          absolute.hash='';
          const dest=captured.get(absolute.href);
          if(!dest)return;
          const relative=file==='index.html'?dest:(dest==='index.html'?'../index.html':'../'+dest);
          $(el).attr('href',relative+fragment);
        } catch {}
      });
      const pageHtml='<!DOCTYPE html>\n'+$.html();
      if(designMode==='redesign'){
        let changed=redesign(pageHtml,{nested:file!=='index.html'});
        zip.file(file,changed);
      }else zip.file(file,pageHtml);
    }
    if(designMode==='redesign')zip.file('sitecloner-redesign.css',redesignCss);

    const assetErrors=[];
    for(const [url,local] of assets) {
      if(zip.file(local) || zip.files[local]) continue;
      if(Object.keys(zip.files).length>ASSET_LIMIT+PAGE_LIMIT || Date.now()-start>DEADLINE-5000)break;
      try {
        await checkUrl(url);
        const response=await context.request.get(url,{timeout:6500,maxRedirects:0});
        if(!response.ok()) throw new Error('HTTP '+response.status());
        const data=await response.body();
        if(data.length>ASSET_MAX || bytes+data.length>ZIP_MAX)throw new Error('Arquivo excedeu limites');
        bytes+=data.length;
        zip.file(local,data);
      } catch(e){assetErrors.push({url,error:e.message});}
    }
    // Optional REA analysis worker. Never exposes its token or URL to the browser.
    // Worker must be behind authenticated HTTPS; an unconfigured/unavailable
    // worker must not break the ordinary Playwright ZIP capture.
    let reaReport={status:'not_configured'};
    if (process.env.REA_WORKER_URL && process.env.REA_WORKER_TOKEN && Date.now()-start<DEADLINE-11000) {
      try {
        const endpoint=new URL(process.env.REA_WORKER_URL);
        if (endpoint.protocol!=='https:' || endpoint.username || endpoint.password) {
          throw new Error('REA_WORKER_URL deve usar HTTPS');
        }
        const abort=new AbortController();
        const timer=setTimeout(()=>abort.abort(),7500);
        try {
          const reaResponse=await fetch(new URL(endpoint.pathname.replace(/\/$/,'')+'/analyze',endpoint.origin).href,{
            method:'POST',signal:abort.signal,
            headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.REA_WORKER_TOKEN},
            body:JSON.stringify({url:entry.href})
          });
          if(!reaResponse.ok) throw new Error('HTTP '+reaResponse.status);
          const raw=await reaResponse.text();
          if(raw.length>80000) throw new Error('Relatório REA acima do limite');
          reaReport=JSON.parse(raw);
        } finally { clearTimeout(timer); }
      } catch(e) { reaReport={status:'unavailable',reason:String(e.message||e).slice(0,160)}; }
    }
    zip.file('rea-analysis.json',JSON.stringify(reaReport,null,2));
    zip.file('captura.json',JSON.stringify({source:entry.href,createdAt:new Date().toISOString(),pages:reports,assetsSaved:Object.keys(zip.files).filter(x=>x.startsWith('assets/')).length,assetErrors,reaStatus:reaReport.status,designMode,maxPages:maximumPages,limitations:['Até dez páginas por operação, conforme prazo de execução','Arquivos de terceiros não são incorporados','Scripts e rotas dinâmicas podem não funcionar offline','Use apenas em sites para os quais você tem autorização']},null,2));
    const payload=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:5}});
    if(payload.length>ZIP_MAX)throw new Error('ZIP excedeu o limite');
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition','attachment; filename="sitecloner-projeto.zip"');
    res.setHeader('X-SiteCloner-Pages',String(reports.filter(x=>x.file).length));
    res.setHeader('Access-Control-Expose-Headers','X-SiteCloner-Pages');
    return res.status(200).send(payload);
  }catch(e){
    console.error('capture error',e.message);
    return res.status(400).json({error:e.message||'Falha inesperada ao capturar'});
  }finally {if(browser)await browser.close().catch(()=>{});}
};
