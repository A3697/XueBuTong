// @ts-check

const { ScriptWorker } = require('./lib/src/worker/index');

const worker = new ScriptWorker();

// 监听消息
process.on(
	'message',
	(
		/** @type {{event: any, args: any}} */
		message
	) => {
		/** 根据 event 名直接调用方法 */
		Promise.resolve().then(()=>worker[message.event](...message.args)).catch(error=>{
            console.error('浏览器操作未完成：',String(error?.message||error).slice(0,500));
            if(['init','launch'].includes(message.event)){
                if(process.connected)process.send({event:'startup-failed',args:[]});
                void worker.close();
            }
        });
	}
);

// A closed OCS parent must not leave its own browser worker running.
process.on('disconnect',()=>{worker.close().catch(()=>process.exit());});
