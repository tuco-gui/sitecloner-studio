'use strict';
const cheerio=require('cheerio');
const css=`
/* Nova proposta visual. Conteúdo, URLs e imagens originais preservados. */
:root{--brand:#b51222;--ink:#171717;--surface:#fff;--muted:#616161}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0!important;background:#f6f6f6!important;color:var(--ink)!important;font-family:Inter,Arial,system-ui,sans-serif!important;line-height:1.65!important}
header,nav,[role=navigation]{background:#171717!important;color:#fff!important}
header a,nav a,[role=navigation] a{color:#fff!important}
main,article,section{max-width:1200px;margin-inline:auto}
h1,h2,h3{letter-spacing:-.03em;line-height:1.18}
h1{font-size:clamp(2rem,5vw,4rem)!important}
h2{font-size:clamp(1.5rem,3vw,2.5rem)!important}
p{max-width:75ch}
img{max-width:100%;height:auto}
button,.btn,a.button,input[type=submit]{border-radius:8px!important}
button,.btn,a.button,input[type=submit]{background:var(--brand)!important;color:white!important;padding:12px 24px!important}
input,textarea,select{max-width:100%;border-radius:8px}
footer{background:#171717!important;color:#fff!important;padding:40px 20px}
@media(max-width:700px){main,article,section{padding-inline:14px}header,nav{flex-wrap:wrap}h1{font-size:2.2rem!important}}
`;
function redesign(html){const $=cheerio.load(html,{decodeEntities:false});$('head').append('<meta name="viewport" content="width=device-width,initial-scale=1">');$('head').append('<link rel="stylesheet" href="sitecloner-redesign.css">');return '<!doctype html>\n'+$.html()}
module.exports={css,redesign};
