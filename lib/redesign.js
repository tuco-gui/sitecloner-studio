'use strict';
const cheerio=require('cheerio');

const css=`
:root{--accent:#c41f31;--ink:#1b1b1d;--paper:#faf9f6;--soft:#f0efec;--line:#dfded9}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,Arial,sans-serif}
a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1190px;margin:auto;padding-inline:24px}
.sitehead{position:sticky;top:0;z-index:5;background:#171719;color:#fff;box-shadow:0 2px 20px #0002}
.sitehead .wrap{display:flex;align-items:center;justify-content:space-between;min-height:84px;gap:20px}
.brand{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:800;letter-spacing:-.025em}.brand img{width:auto;height:52px;max-width:185px;object-fit:contain}
.navlinks{display:flex;gap:20px;flex-wrap:wrap;font-size:14px}.navlinks a{opacity:.85}
.hero{padding:92px 0 84px;background:linear-gradient(120deg,#151518 0%,#252327 60%,#71202a 100%);color:#fff}
.eyebrow{display:block;text-transform:uppercase;letter-spacing:.16em;color:#f3aab3;font-weight:800;font-size:12px}
.hero h1{font-size:clamp(38px,5vw,70px);line-height:1.08;letter-spacing:-.055em;max-width:860px;margin:18px 0 22px}
.hero p{font-size:clamp(17px,2vw,21px);max-width:750px;color:#e7e3e2}
.btn{display:inline-flex;align-items:center;background:var(--accent);border-radius:8px;color:#fff;padding:13px 24px;font-weight:750;margin-top:20px}
.content{padding-block:66px 90px}.intro{max-width:850px;margin-bottom:36px}
.intro h2{font-size:clamp(27px,3.5vw,42px);line-height:1.2;margin:0 0 12px}
.intro p{color:#555;font-size:17px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 12px 30px #00000008}
.card img{width:100%;height:240px;object-fit:cover;background:#eaeaea;display:block}
.card .copy{padding:24px}.card h3{font-size:21px;line-height:1.25;margin:0 0 10px}.card p{color:#626262;margin:0 0 8px}
.features{padding:55px 0;background:var(--soft)}.features .wrap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}
.features article{padding:20px 0;border-top:3px solid var(--accent)}.features h3{margin:0 0 8px}
.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding-top:30px}.gallery img{width:100%;height:260px;object-fit:cover;border-radius:8px}
footer{background:#171719;color:#fff;padding:46px 0}footer p{color:#bfbcbc}
@media(max-width:800px){.sitehead .wrap{align-items:flex-start;flex-direction:column;padding-block:14px}.hero{padding-block:64px}.cards,.gallery,.features .wrap{grid-template-columns:1fr}.gallery img{height:230px}.card img{height:260px}}
`;
function clean(s,max=400){return String(s||'').replace(/\s+/g,' ').trim().slice(0,max)}
function esc(s){return clean(s,1000).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function safeSrc(src){const x=String(src||'').trim();return /^(assets\/|\.\.\/assets\/|https?:\/\/|data:image\/)/i.test(x)?x:''}
function safeHref(href){const h=String(href||'').trim();return /^(https?:\/\/|\/|\.\.\/|pages\/|index\.html|#)/i.test(h)?h:'#'}
function redesign(html,options={}){
 const $=cheerio.load(html,{decodeEntities:false});
 $('script,style,noscript,iframe,template,svg,form').remove();
 const title=clean($('title').first().text()||$('h1').first().text()||'Novo site',130);
 const headings=$('h1,h2,h3').map((_,el)=>clean($(el).text(),140)).get().filter(Boolean);
 const paragraphs=$('main p,article p,section p,p').map((_,el)=>clean($(el).text(),360)).get().filter(x=>x.length>=25);
 const unique=(items)=>[...new Set(items)];
 const images=[];
 $('img').each((_,el)=>{const src=safeSrc($(el).attr('src')||$(el).attr('data-src'));if(src&&!images.some(x=>x.src===src))images.push({src,alt:clean($(el).attr('alt'),100)})});
 const logo=images.find(x=>/logo|marca|brand/i.test(x.alt+' '+x.src))||$('header img').first().length&&images[0]||null;
 const gallery=images.filter(x=>x!==logo).slice(0,12);
 const links=[];
 $('nav a[href],header a[href],a[href]').each((_,el)=>{const text=clean($(el).text(),35);const href=safeHref($(el).attr('href'));if(text&&text.length<35&&href!=='#'&&!links.some(x=>x.text===text)&&links.length<7)links.push({text,href})});
 const hero=headings[0]||title;const subtitle=paragraphs[0]||'Conheça nossos serviços, projetos e soluções.';
 const cards=unique(headings.slice(1)).slice(0,6).map((h,i)=>({title:h,body:paragraphs[i+1]||'',image:gallery[i]||null}));
 if(!cards.length) paragraphs.slice(1,5).forEach((p,i)=>cards.push({title:'Conheça mais',body:p,image:gallery[i]||null}));
 if(!cards.length && gallery.length)gallery.slice(0,6).forEach(img=>cards.push({title:img.alt||'Galeria',body:'',image:img}));
 const nav=links.map(x=>'<a href="'+esc(x.href)+'">'+esc(x.text)+'</a>').join('');
 const cardHtml=cards.map(c=>'<article class="card">'+(c.image?'<img loading="lazy" src="'+esc(c.image.src)+'" alt="'+esc(c.image.alt)+'">':'')+'<div class="copy"><h3>'+esc(c.title)+'</h3><p>'+esc(c.body)+'</p></div></article>').join('');
 const galleryHtml=gallery.slice(cards.length).slice(0,6).map(x=>'<img loading="lazy" src="'+esc(x.src)+'" alt="'+esc(x.alt)+'">').join('');
 const brand=logo?'<img src="'+esc(logo.src)+'" alt="'+esc(logo.alt||title)+'">':esc(title);
 const stylesheet=options.nested?'../sitecloner-redesign.css':'sitecloner-redesign.css';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+'</title><link rel="stylesheet" href="'+stylesheet+'"></head><body>'+
 '<header class="sitehead"><div class="wrap"><a class="brand" href="'+(options.nested?'../index.html':'index.html')+'">'+brand+'</a><nav class="navlinks" aria-label="Menu">'+nav+'</nav></div></header>'+
 '<main><section class="hero"><div class="wrap"><span class="eyebrow">Explore</span><h1>'+esc(hero)+'</h1><p>'+esc(subtitle)+'</p>'+(links[0]?'<a class="btn" href="'+esc(links[0].href)+'">'+esc(links[0].text)+'</a>':'')+'</div></section>'+
 '<section class="content wrap"><div class="intro"><h2>'+esc(headings[1]||'O que oferecemos')+'</h2><p>'+esc(paragraphs[1]||subtitle)+'</p></div><div class="cards">'+cardHtml+'</div>'+(galleryHtml?'<div class="gallery">'+galleryHtml+'</div>':'')+'</section></main>'+
 '<footer><div class="wrap"><strong>'+esc(title)+'</strong><p>Conteúdo e imagens públicos extraídos do site de referência. Proposta visual independente.</p></div></footer></body></html>';
}
module.exports={css,redesign};
