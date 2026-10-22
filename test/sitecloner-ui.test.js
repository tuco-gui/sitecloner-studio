const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {redesign,css}=require('../lib/redesign');
test('page JavaScript parses',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/i);
 assert.ok(script,'inline script exists');
 assert.doesNotThrow(()=>new vm.Script(script[1]));
});
test('redesign preserves text, image and logo names',()=>{
 const html='<!DOCTYPE html><html><head><title>Empresa</title></head><body><header><img alt="Marca" src="assets/logo.png"></header><main><h1>Sobre nós</h1></main></body></html>';
 const result=redesign(html);
 assert.match(result,/Sobre nós/);assert.match(result,/assets\/logo.png/);assert.match(result,/sitecloner-redesign.css/);assert.match(css,/--accent/);
});

test('redesign discards hidden original CSS and builds real cards',()=>{
 const html='<!doctype html><html><head><style>body{display:none}</style></head><body><header><img alt="Logo Empresa" src="assets/logo.png"><nav><a href="/sobre">Sobre</a></nav></header><main><h1>Empresa Especialista</h1><section><h2>Nossos serviços</h2><p>Projetos personalizados para nossos clientes em todo o Brasil.</p><img src="assets/produto.jpg" alt="Produto"></section></main></body></html>';
 const result=redesign(html);
 assert.match(result,/class="hero"/);assert.match(result,/class="cards"/);
 assert.match(result,/assets\/logo.png/);assert.match(result,/assets\/produto.jpg/);
 assert.match(result,/Empresa Especialista/);assert.doesNotMatch(result,/display:none/);
});
test('nested redesigned page uses correct CSS and home paths',()=>{
 const result=redesign('<html><body><h1>Outra pagina</h1></body></html>',{nested:true});
 assert.match(result,/href="\.\.\/sitecloner-redesign.css"/);
 assert.match(result,/href="\.\.\/index.html"/);
});
