'use strict';
const VALID_KINDS=new Set(['site','ecommerce','webapp']);
const VALID_MODES=new Set(['faithful','redesign']);
function normalizedTarget(input){
 const u=new URL(input);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||u.hostname==='localhost'||u.hostname.endsWith('.internal'))throw Error('URL de origem inválida');
 u.hash='';return u.href;
}
function makeSpec(request,rea){
 const source=normalizedTarget(request.url);
 if(!VALID_KINDS.has(request.kind))throw Error('Tipo de projeto inválido');
 if(!VALID_MODES.has(request.designMode))throw Error('Modo de projeto inválido');
 if(!rea||rea.status!=='ok'||!rea.coverage?.successful?.includes('inspect_web_page')||!rea.coverage?.successful?.includes('analyze_web_bundle'))throw Error('Engenharia reversa REA incompleta: não gerar código sem evidências');
 const origin=new URL(source).origin;
 const pageUrls=[source,...(rea.hints?.pageUrls||[])].filter((s,i,a)=>{try{const u=new URL(s);return u.origin===origin&&a.indexOf(s)===i}catch{return false}}).slice(0,24);
 const imageUrls=(rea.hints?.imageUrls||[]).filter(s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.username===''&&u.password===''}catch{return false}}).slice(0,30);
 const notes=String(request.instructions||'').trim().slice(0,1500);
 const cleanObs=(rea.observations||[]).filter(x=>x.status==='ok').map(x=>({tool:x.tool,summary:(x.evidenceSummary||[]).map(s=>String(s).slice(0,5000)).slice(0,2)}));
 return {schemaVersion:1,source,origin,kind:request.kind,designMode:request.designMode,instructions:notes,
   observed:{framework:rea.hints?.framework||null,pages:pageUrls,images:imageUrls,rea:cleanObs},
   limitations:['Backend, contas de terceiros e pagamentos não são extraídos nem reproduzidos sem integração autorizada'],
   generatedAt:new Date().toISOString()};
}
module.exports={makeSpec,normalizedTarget};
