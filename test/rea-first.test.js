const test=require('node:test');
const assert=require('node:assert/strict');
const {extractReaHints}=require('../worker/server');
const {isPageUrl,extractLocs,prioritize}=require('../lib/sitemap-discovery');
const {redesign}=require('../lib/redesign');

test('REA network evidence yields same-origin routes and public media URLs',()=>{
 const origin='https://www.realizeimobi.imb.br/';
 const evidence='Next.js https://www.realizeimobi.imb.br/imoveis/botucatu-sp-brasil https://static.arboimoveis.com.br/123/imovel.jpg https://www.realizeimobi.imb.br/api/listings.json';
 const hints=extractReaHints(evidence,origin);
 assert.equal(hints.framework,'nextjs');
 assert.ok(hints.pageUrls.includes('https://www.realizeimobi.imb.br/imoveis/botucatu-sp-brasil'));
 assert.ok(hints.imageUrls.some(x=>x.endsWith('/imovel.jpg')));
 assert.ok(!hints.pageUrls.some(x=>x.includes('/api/listings.json')));
});

test('Nested XML sitemap routes are accepted but XMLs are not pages',()=>{
 const origin='https://www.realizeimobi.imb.br';
 const xml='<sitemapindex><sitemap><loc>https://www.realizeimobi.imb.br/api/city-routes/botucatu.xml</loc></sitemap></sitemapindex>';
 assert.deepEqual(extractLocs(xml,origin),[origin+'/api/city-routes/botucatu.xml']);
 assert.equal(isPageUrl(origin+'/api/city-routes/botucatu.xml',origin),false);
 assert.equal(isPageUrl(origin+'/imoveis/botucatu-sp-brasil',origin),true);
 assert.equal(isPageUrl('http://127.0.0.1/admin',origin),false);
});

test('Property listing routes are prioritized ahead of generic footer pages',()=>{
 const list=['https://site.example.com/contato','https://site.example.com/imoveis/botucatu','https://site.example.com/sobre'];
 assert.equal(prioritize(list)[0],list[1]);
});

test('Redesign reuses captured listing photos when homepage does not contain them',()=>{
 const html='<html><head><title>Realize Imoveis</title></head><body><h1>Encontre seu lar</h1><p>Imoveis em Botucatu e regiao</p></body></html>';
 const out=redesign(html,{extraImages:[{src:'assets/foto-imovel.jpg',alt:'Apartamento'}]});
 assert.match(out,/assets\/foto-imovel.jpg/);
});
