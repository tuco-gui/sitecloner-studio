const {cookieHeader,validOrigin}=require('../lib/session-auth');
module.exports=(req,res)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Use POST'});if(!validOrigin(req))return res.status(403).json({error:'Origem não autorizada'});res.setHeader('Set-Cookie',cookieHeader(req,'',0));return res.status(200).json({ok:true})};
