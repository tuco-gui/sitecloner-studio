'use strict';
function rewriteCss(css,base,add){
 return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,(match,q,raw)=>{
  const ref=raw.trim();
  if(!ref||/^(data:|blob:|#|about:)/i.test(ref))return match;
  try{
   const absolute=new URL(ref,base);
   if(!['http:','https:'].includes(absolute.protocol))return match;
   const relative=add(absolute.href);
   if(!relative)return match;
   return 'url("'+relative+'")';
  }catch{return match}
 });
}
module.exports={rewriteCss};
