'use strict';
function isPageUrl(value,origin){
 try{
  const u=new URL(value);
  return (u.protocol==='https:'||u.protocol==='http:') && !u.username&&!u.password&&
   u.origin===origin && !/\.(?:xml|json|pdf|zip|js|css|png|jpe?g|webp|gif|svg|woff2?)$/i.test(u.pathname);
 }catch{return false}
}
function extractLocs(xml,origin){
 const hits=[];
 for(const m of String(xml||'').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)){
  const x=m[1].replace(/&amp;/g,'&').trim();
  try{const u=new URL(x);if(u.origin===origin&&!hits.includes(u.href))hits.push(u.href)}catch{}
  if(hits.length>=150)break;
 }
 return hits;
}
function prioritize(urls){
 return [...new Set(urls)].sort((a,b)=>{
  const score=x=>/\/imoveis\//i.test(x)?5:/\/imovel\//i.test(x)?4:/\/(sobre|nossotime|contato|fale-conosco)/i.test(x)?3:0;
  return score(b)-score(a);
 });
}
module.exports={isPageUrl,extractLocs,prioritize};
