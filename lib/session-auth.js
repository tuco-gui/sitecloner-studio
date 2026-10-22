'use strict';
const crypto=require('node:crypto');
const COOKIE='sitecloner_session';
const TTL=7*24*60*60;
const same=(a,b)=>{const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};
const sign=(v)=>crypto.createHmac('sha256',process.env.SITECLONER_SESSION_SECRET||'').update(v).digest('base64url');
function authenticate(email,password){
 const hash=process.env.SITECLONER_PASSWORD_HASH||'';
 const match=/^([0-9a-f]{32}):([0-9a-f]{128})$/.exec(hash);
 if(!match||!process.env.SITECLONER_SESSION_SECRET||!process.env.SITECLONER_LOGIN_EMAIL)return false;
 if(!same(String(email||'').trim().toLowerCase(),process.env.SITECLONER_LOGIN_EMAIL.trim().toLowerCase()))return false;
 if(typeof password!=='string'||password.length>300)return false;
 try{return crypto.timingSafeEqual(crypto.scryptSync(password,Buffer.from(match[1],'hex'),64,{N:16384,r:8,p:1}),Buffer.from(match[2],'hex'))}catch{return false}
}
function makeToken(email){const data=Buffer.from(JSON.stringify({email,exp:Math.floor(Date.now()/1000)+TTL})).toString('base64url');return data+'.'+sign(data)}
function checkSession(req){
 const secret=process.env.SITECLONER_SESSION_SECRET||'';
 if(!secret)return false;
 const cookie=(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!cookie)return false;
 const token=cookie.slice(COOKIE.length+1),i=token.lastIndexOf('.');
 if(i<0)return false;
 const data=token.slice(0,i),mac=token.slice(i+1);
 if(!same(mac,sign(data)))return false;
 try{const p=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));return p.exp>Math.floor(Date.now()/1000)&&p.email===process.env.SITECLONER_LOGIN_EMAIL}catch{return false}
}
function cookieHeader(req,token,maxAge=TTL){
 const secure=process.env.NODE_ENV==='production'||String(req.headers?.['x-forwarded-proto']||'').includes('https');
 return COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+maxAge+(secure?'; Secure':'');
}
function validOrigin(req){const origin=req.headers?.origin,host=req.headers?.host;if(!origin||!host)return false;try{return new URL(origin).host===host&&new URL(origin).protocol==='https:'}catch{return false}}
module.exports={authenticate,makeToken,checkSession,cookieHeader,validOrigin};
