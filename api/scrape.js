const { chromium: playwright } = require('playwright-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const JSZip = require('jszip');
const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');

const PAGE_LIMIT = 3;
const ASSET_LIMIT = 100;
const ASSET_MAX = 3 * 1024 * 1024;
const ZIP_MAX = 30 * 1024 * 1024;
const DEADLINE = 48000;

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
  let browser;
  try {
    const entry=await checkUrl(req.body?.url);
    const origin=entry.origin;
    const zip=new JSZip();
    const start=Date.now();
    let bytes=0;
    const assets=new Map(), discovered=[], visited=new Set(), reports=[];
    let firstHtml='';
    browser=await playwright.launch({
      executablePath:await chromium.executablePath(),
      headless:true,
      args:chromium.args
    });
    const context=await browser.newContext({ignoreHTTPSErrors:false,serviceWorkers:'block',acceptDownloads:false});
    await context.route('**/*', async route=>{
      const raw=route.request().url();
      try {
        const u=new URL(raw);
        if(u.protocol==='data:' || u.protocol==='blob:' || u.protocol==='about:') return route.continue();
        await checkUrl(raw, origin);
        if(Date.now()-start>DEADLINE) return route.abort();
        return route.continue();
      } catch { return route.abort(); }
    });
    const page=await context.newPage();
    page.setDefaultTimeout(10000);
    const queue=[entry.href];
    while(queue.length && reports.length<PAGE_LIMIT && Date.now()-start<DEADLINE-8000) {
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
          const value=$(el).attr(name);
          if(!value) return;
          try {
            const absolute=new URL(value,current).href;
            const u=new URL(absolute);
            if(!['http:','https:'].includes(u.protocol) || u.origin!==origin) return;
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
            const known=[entry.href,...queue];
            const ix=known.indexOf(next.href);
            if(ix>=0 && ix<PAGE_LIMIT) $(el).attr('href',reports.length===0 ? pathForPage(next.href,ix) : '../'+pathForPage(next.href,ix));
            else $(el).attr('href',next.href);
          } catch{}
        });
        $('*').each((_,el)=>{
          for(const key of Object.keys(el.attribs||{})){
            if(key.toLowerCase().startsWith('on')) $(el).removeAttr(key);
          }
        });
        const html='<!DOCTYPE html>\n'+$.html();
        const index=reports.length;
        if(index===0)firstHtml=html;
        const file=pathForPage(current.href,index);
        zip.file(file,html);
        reports.push({url:current.href,file,title:$('title').first().text().trim().slice(0,150)});
      } catch(e) {
        reports.push({url:normalized,error:e.message});
      }
    }
    if(!firstHtml) throw new Error('Não foi possível capturar a primeira página');
    const assetErrors=[];
    for(const [url,local] of assets) {
      if(zip.file(local) || zip.files[local]) continue;
      if(Object.keys(zip.files).length>ASSET_LIMIT+PAGE_LIMIT || Date.now()-start>DEADLINE-5000)break;
      try {
        await checkUrl(url,origin);
        const response=await context.request.get(url,{timeout:6500,maxRedirects:0});
        if(!response.ok()) throw new Error('HTTP '+response.status());
        const data=await response.body();
        if(data.length>ASSET_MAX || bytes+data.length>ZIP_MAX)throw new Error('Arquivo excedeu limites');
        bytes+=data.length;
        zip.file(local,data);
      } catch(e){assetErrors.push({url,error:e.message});}
    }
    zip.file('captura.json',JSON.stringify({source:entry.href,createdAt:new Date().toISOString(),pages:reports,assetsSaved:Object.keys(zip.files).filter(x=>x.startsWith('assets/')).length,assetErrors,limitations:['Até três páginas por operação','Arquivos de terceiros não são incorporados','Scripts e rotas dinâmicas podem não funcionar offline','Use apenas em sites para os quais você tem autorização']},null,2));
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
