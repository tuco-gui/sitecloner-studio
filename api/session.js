const {checkSession}=require('../lib/session-auth');
module.exports=(req,res)=>{res.setHeader('Cache-Control','no-store');return res.status(200).json({authenticated:checkSession(req)})};
