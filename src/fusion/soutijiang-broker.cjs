'use strict';
let pool;
function install(value){pool=value;}
async function handle(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.get('origin')||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return res.status(403).json({error:'login_share_unauthorized'});
 try{if(!pool)throw Error();res.json(await pool.exchange(req.get('X-XueBuTong-Soutijiang'),req.body));}
 catch{res.status(409).json({error:'login_share_unavailable'});}
}
module.exports={install,handle};
