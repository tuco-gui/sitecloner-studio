'use strict';
const JSZip=require('jszip');
const crypto=require('node:crypto');
const PATH_RE=/^src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jsx|js|css|json)$/;
function normalizeProject(modelOutput,spec){
 if(!modelOutput||!Array.isArray(modelOutput.files))throw Error('Modelo não retornou arquivos');
 const files=new Map();let bytes=0;
 for(const f of modelOutput.files){
  if(typeof f?.path!=='string'||!PATH_RE.test(f.path)||typeof f.content!=='string')throw Error('Arquivo não permitido na geração: '+String(f?.path).slice(0,80));
  if(files.has(f.path)||f.path==='src/main.jsx')throw Error('Arquivo duplicado ou reservado');
  if(f.content.includes('\u0000'))throw Error('Arquivo contém bytes nulos');
  bytes+=Buffer.byteLength(f.content);
  if(bytes>240000||files.size>=16)throw Error('Projeto excede limites de tamanho ou número de arquivos');
  files.set(f.path,f.content);
 }
 if(!files.has('src/App.jsx'))throw Error('Agente não criou src/App.jsx');
 const app=files.get('src/App.jsx');
 if(!/export\s+default\s+/m.test(app))throw Error('App.jsx não exporta componente padrão');
 if(!files.has('src/styles.css'))files.set('src/styles.css','body{margin:0;font-family:system-ui,sans-serif}');
 // Source files only; package/scripts are pinned and cannot be controlled by the model.
 const pkg={name:'sitecloner-generated',version:'1.0.0',private:true,type:'module',
  scripts:{dev:'vite --host 127.0.0.1',build:'vite build'},
  dependencies:{react:'^19.2.0','react-dom':'^19.2.0'},
  devDependencies:{vite:'^7.1.0'}};
 const entry='<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>';
 const main="import React from 'react';import{createRoot}from'react-dom/client';import App from './App.jsx';import './styles.css';createRoot(document.getElementById('root')).render(React.createElement(App));";
 const summary=String(modelOutput.summary||'').slice(0,1000);
 const limitations=(Array.isArray(modelOutput.limitations)?modelOutput.limitations:[]).slice(0,12).map(x=>String(x).slice(0,240));
 return {files,packageJson:JSON.stringify(pkg,null,2),entry,main,summary,limitations,spec};
}
async function projectZip(project,preview){
 const z=new JSZip();
 z.file('package.json',project.packageJson);z.file('index.html',project.entry);z.file('src/main.jsx',project.main);
 for(const [name,content]of project.files)z.file(name,content);
 if(preview?.files){for(const [name,content] of preview.files)z.file(name,content)}
 z.file('site-spec.json',JSON.stringify(project.spec,null,2));
 z.file('result.json',JSON.stringify({summary:project.summary,limitations:project.limitations,generatedAt:new Date().toISOString()},null,2));
 z.file('README.md','# Projeto reconstruído com REA + IA\n\nExecute npm install e npm run dev. O diretório preview contém o código compilado.\n\nO conteúdo observado serve de referência. Backends, pagamentos e contas de terceiros não são extraídos.\n');
 const buffer=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
 return {buffer,sha256};
}
module.exports={normalizeProject,projectZip};
