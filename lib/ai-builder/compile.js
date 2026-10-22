'use strict';
const esbuild=require('esbuild');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
async function compileProject(project){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sitecloner-compile-'));
 try{
  const srcRoot=path.join(root,'src');await fs.mkdir(srcRoot,{recursive:true});
  for(const [file,content] of project.files){
   const absolute=path.join(root,file);
   if(!absolute.startsWith(srcRoot+path.sep))throw Error('Fora do src');
   await fs.mkdir(path.dirname(absolute),{recursive:true});
   await fs.writeFile(absolute,content,{flag:'wx',mode:0o600});
  }
  await fs.writeFile(path.join(srcRoot,'main.jsx'),project.main,{mode:0o600});
  const result=await esbuild.build({
   absWorkingDir:root,entryPoints:['src/main.jsx'],bundle:true,write:false,
   outdir:'dist',entryNames:'app',format:'iife',platform:'browser',
   target:['es2022'],minify:true,logLevel:'silent',
   nodePaths:[path.resolve(__dirname,'../../node_modules')],
   loader:{'.jsx':'jsx','.js':'jsx','.css':'css','.json':'json'},
   conditions:['browser','module','default']
  });
  const output=new Map();
  for(const file of result.outputFiles){
   const name=path.basename(file.path);
   if(!['app.js','app.css'].includes(name))throw Error('Saída inesperada do compilador');
   if(file.contents.length>1024*1024)throw Error('Bundle gerado muito grande');
   output.set('preview/'+name,Buffer.from(file.contents));
  }
  if(!output.has('preview/app.js'))throw Error('Compilador não gerou JavaScript');
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prévia reconstruída</title><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script defer src="app.js"></script></body></html>';
  output.set('preview/index.html',html);
  return {files:output,warnings:result.warnings.map(x=>x.text).slice(0,10)};
 }finally{await fs.rm(root,{recursive:true,force:true})}
}
module.exports={compileProject};
