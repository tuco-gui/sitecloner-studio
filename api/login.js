const {authenticate,makeToken,cookieHeader,validOrigin}=require('../lib/session-auth');
const attempts=new Map();
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
 if(!validOrigin(req))return res.status(403).json({error:'Origem não autorizada'});
 const id=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].slice(0,100);
 const t=Date.now(),v=attempts.get(id)||{count:0,until:t};
 if(v.until<t){v.count=0;v.until=t+15*60*1000}
 if(v.count>=8)return res.status(429).json({error:'Muitas tentativas. Tente novamente mais tarde.'});
 if(!authenticate(req.body?.email,req.body?.password)){
  v.count++;attempts.set(id,v);return res.status(401).json({error:'E-mail ou senha inválidos'});
 }
 attempts.delete(id);
 res.setHeader('Set-Cookie',cookieHeader(req,makeToken(process.env.SITECLONER_LOGIN_EMAIL)));
 return res.status(200).json({ok:true,email:process.env.SITECLONER_LOGIN_EMAIL});
};
