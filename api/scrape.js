const dns = require('node:dns').promises;
const net = require('node:net');
const cheerio = require('cheerio');

function blockedIp(ip) {
  if (net.isIP(ip) === 4) {
    const a = ip.split('.').map(Number);
    return a[0]===0 || a[0]===10 || a[0]===127 || a[0]>=224 ||
      a[0]===169&&a[1]===254 || a[0]===172&&a[1]>=16&&a[1]<=31 ||
      a[0]===192&&a[1]===168 || a[0]===100&&a[1]>=64&&a[1]<=127 ||
      a[0]===192&&a[1]===0 || a[0]===198&&[18,19].includes(a[1]);
  }
  if (net.isIP(ip) === 6) {
    const n=ip.toLowerCase();
    return n==='::1'||n==='::'||n.startsWith('fc')||n.startsWith('fd')||n.startsWith('fe8')||n.startsWith('fe9')||n.startsWith('fea')||n.startsWith('feb')||n.startsWith('::ffff:');
  }
  return true;
}
async function validate(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL inválida'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || !['','80','443'].includes(u.port)) throw new Error('URL ou porta não permitida');
  if (u.hostname === 'localhost' || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal')) throw new Error('Endereço interno não permitido');
  let hosts;
  try { hosts = await dns.lookup(u.hostname, {all:true}); } catch { throw new Error('Domínio não encontrado'); }
  if (!hosts.length || hosts.some(x=>blockedIp(x.address))) throw new Error('Endereço não público');
  return u;
}
module.exports = async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  try {
    const u=await validate(req.body?.url);
    let current=u;
    let response;
    for(let i=0;i<4;i++){
      response=await fetch(current.href,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0 (compatible; SiteClonerStudio/1.0)','Accept':'text/html'}});
      if([301,302,303,307,308].includes(response.status)){
        current=await validate(new URL(response.headers.get('location'),current).href);
        continue;
      }
      break;
    }
    if(!response || !response.ok || response.status>=300) throw new Error('O site recusou a captura (HTTP '+(response?.status || 'sem resposta')+')');
    if(!(response.headers.get('content-type')||'').includes('text/html')) throw new Error('A URL não retornou uma página HTML');
    const length=Number(response.headers.get('content-length')||0);
    if(length>2200000) throw new Error('Página maior que o limite de 2,2 MB');
    const reader=response.body.getReader(); let parts=[], total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>2200000){await reader.cancel();throw new Error('Página maior que o limite de 2,2 MB')}parts.push(value)}
    const buffer=Buffer.concat(parts.map(x=>Buffer.from(x)));
    const $=cheerio.load(buffer.toString('utf8'));
    $('script, iframe, object, embed, form, base, meta[http-equiv="refresh"]').remove();
    $('*').each((_,el)=>{
      const attrs={...(el.attribs||{})};
      Object.keys(attrs).forEach(name=>{
        const value=attrs[name]||'';
        if(name.toLowerCase().startsWith('on')) $(el).removeAttr(name);
        if(['href','src','poster','action','data-src'].includes(name) && value) {
          try {
            const abs=new URL(value,current).href;
            if(!/^https?:/.test(abs)) $(el).removeAttr(name);
            else $(el).attr(name,abs);
          } catch {$(el).removeAttr(name)}
        }
        if(name==='srcset') $(el).removeAttr(name);
      });
    });
    $('head').prepend('<meta charset="utf-8">');
    const title=$('title').first().text().trim().slice(0,160)||current.hostname;
    const images=$('img').length;const links=$('a[href]').length;
    const html='<!DOCTYPE html>\n'+$.html();
    return res.status(200).json({url:current.href,title,images,links,html});
  } catch(e) {
    return res.status(400).json({error:e.message||'Erro inesperado'});
  }
};
