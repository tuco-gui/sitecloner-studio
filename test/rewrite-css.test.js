const test=require('node:test'),assert=require('node:assert/strict');
const {rewriteCss}=require('../lib/rewrite-css');
test('CSS local backgrounds and fonts become downloaded references',()=>{
 const refs=[];
 const input='a{background:url("../img/hero.jpg")}@font-face{src:url(/fonts/main.woff2)}a{background-image:url(data:image/png;base64,abc)}';
 const result=rewriteCss(input,'https://example.com/assets/site.css',x=>{refs.push(x);return './local-'+refs.length});
 assert.deepEqual(refs,['https://example.com/img/hero.jpg','https://example.com/fonts/main.woff2']);
 assert.match(result,/url\("\.\/local-1"\)/);
 assert.match(result,/url\("\.\/local-2"\)/);
 assert.match(result,/data:image\/png/);
});
