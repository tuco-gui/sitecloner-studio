'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const {makeSpec}=require('../lib/ai-builder/spec');
const {generateWithModel,modelConfig}=require('../lib/ai-builder/model');
const {normalizeProject,projectZip}=require('../lib/ai-builder/project');
const {compileProject}=require('../lib/ai-builder/compile');
const sampleRea={status:'ok',coverage:{successful:['inspect_web_page','analyze_web_bundle']},
 hints:{pageUrls:['https://www.realizeimobi.imb.br/imoveis/botucatu-sp-brasil','https://other.example.com/private'],
 imageUrls:['https://static.arboimoveis.com.br/assets/imovel.jpg'],framework:'nextjs'},
 observations:[{tool:'inspect_web_page',status:'ok',evidenceSummary:['header, menu, busca, imoveis']},{tool:'analyze_web_bundle',status:'ok',evidenceSummary:['React']}]};
const sampleOutput={files:[
 {path:'src/App.jsx',content:"import React from 'react'; export default function App(){return <main><h1>Imóveis em Botucatu</h1><input aria-label='Buscar'/><button>Buscar</button></main>}"},
 {path:'src/styles.css',content:'body{margin:0;background:#fafafa}main{padding:32px}'}
],summary:'Página de imóveis de demonstração',limitations:['Dados de imóveis demonstrativos']};
test('REA duas ferramentas obrigatórias para iniciar geração',()=>{
 const spec=makeSpec({url:'https://www.realizeimobi.imb.br/',kind:'ecommerce',designMode:'redesign'},sampleRea);
 assert.equal(spec.observed.pages.length,2);
 assert.equal(spec.observed.images.length,1);
 assert.equal(spec.designMode,'redesign');
 assert.throws(()=>makeSpec({url:spec.source,kind:'site',designMode:'faithful'},{status:'ok',coverage:{successful:['inspect_web_page']}}),/incompleta/);
});
test('código React compilado gera prévia e ZIP com documentação e especificação',async()=>{
 const spec=makeSpec({url:'https://www.realizeimobi.imb.br/',kind:'site',designMode:'faithful'},sampleRea);
 const project=normalizeProject(sampleOutput,spec);
 const preview=await compileProject(project);
 assert.ok(preview.files.get('preview/app.js').length>1000);
 assert.match(preview.files.get('preview/index.html'),/app.js/);
 const {buffer,sha256}=await projectZip(project,preview);
 assert.equal(sha256.length,64);
 const zip=await JSZip.loadAsync(buffer);
 for(const path of ['package.json','src/App.jsx','src/styles.css','site-spec.json','preview/app.js','preview/app.css','preview/index.html'])assert.ok(zip.file(path),path);
 const pkg=JSON.parse(await zip.file('package.json').async('string'));
 assert.equal(pkg.scripts.build,'vite build');
});
test('não aceita arquivo fora do diretório e bloqueia alteração de scripts',()=>{
 const spec=makeSpec({url:'https://www.realizeimobi.imb.br/',kind:'site',designMode:'faithful'},sampleRea);
 for(const malicious of ['../../passwords.txt','package.json','src/main.jsx','src/../outside.js']){
  assert.throws(()=>normalizeProject({files:[...sampleOutput.files,{path:malicious,content:'malicioso'}]},spec),/não permitido|reservado/);
 }
});
test('adapter envia evidências por HTTPS e interpreta projeto gerado',async()=>{
 const spec=makeSpec({url:'https://www.realizeimobi.imb.br/',kind:'site',designMode:'faithful'},sampleRea);
 let called=0;
 const result=await generateWithModel(spec,{endpoint:'https://model.example.com/v1/chat/completions',model:'mock',token:'test-key'},async(url,options)=>{
  called++;assert.equal(url,'https://model.example.com/v1/chat/completions');
  assert.equal(options.headers.Authorization,'Bearer test-key');
  assert.match(options.body,/inspect_web_page/);
  return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(sampleOutput)}}],usage:{prompt_tokens:123,completion_tokens:77}})};
 });
 assert.equal(called,1);
 assert.equal(result.output.files[0].path,'src/App.jsx');
 assert.equal(result.usage.outputTokens,77);
 assert.equal(modelConfig({BUILDER_MODEL_ENDPOINT:'',BUILDER_MODEL_NAME:'mock'}),null);
});

test('reparo envia diagnóstico do compilador e exige novo projeto completo',async()=>{
 const spec=makeSpec({url:'https://www.realizeimobi.imb.br/',kind:'site',designMode:'redesign'},sampleRea);
 const broken={files:[{path:'src/App.jsx',content:'export default function App(){ return <div>'}]};
 let body;
 const result=await generateWithModel(spec,{endpoint:'https://model.example.com/v1/chat/completions',model:'mock',token:'test'},async(url,options)=>{
  body=JSON.parse(options.body);
  return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(sampleOutput)}}],usage:{prompt_tokens:100,completion_tokens:150}})};
 },{previousProject:broken,compilerError:'JSX syntax error'});
 assert.match(body.messages[1].content,/JSX syntax error/);
 assert.match(body.messages[1].content,/previousProject/);
 assert.equal(result.output.files.length,2);
});
