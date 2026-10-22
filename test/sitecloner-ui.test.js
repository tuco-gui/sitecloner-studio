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
 assert.match(result,/Sobre nós/);assert.match(result,/assets\/logo.png/);assert.match(result,/sitecloner-redesign.css/);assert.match(css,/--brand/);
});
