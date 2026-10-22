'use strict';
const crypto=require('node:crypto');
function isAuthorized(req,secret=process.env.SITECLONER_API_KEY) {
  if(!secret) return false; // fail closed whenever the protected version is deployed
  const header=req.headers?.['x-sitecloner-key'];
  if(typeof header!=='string')return false;
  const a=crypto.createHash('sha256').update(header).digest();
  const b=crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a,b);
}
module.exports={isAuthorized};
