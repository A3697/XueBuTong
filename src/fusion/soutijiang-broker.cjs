'use strict';
let pool;
function install(value){pool=value;}
async function handle(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.get('origin')||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return res.status(403).json({error:'login_share_unauthorized'});
 try{if(!pool)throw Error();const token=req.get('X-XueBuTong-Soutijiang');res.json(await (req.body?.action==='quota'?pool.browserQuota(token,req.body):pool.exchange(token,req.body)));}
 catch{res.status(409).json({error:'login_share_unavailable'});}
}
module.exports={install,handle};
