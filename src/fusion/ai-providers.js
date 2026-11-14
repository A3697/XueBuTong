(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionAiProviders=api;})(globalThis,()=>[
 {id:'deepseek',name:'DeepSeek',baseUrl:'https://api.deepseek.com',type:'openai',docs:'https://api-docs.deepseek.com/api/list-models/'},
 {id:'qwen',name:'阿里云百炼 · 通义千问（北京）',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',type:'openai',docs:'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope'},
 {id:'siliconflow',name:'硅基流动 SiliconFlow',baseUrl:'https://api.siliconflow.cn/v1',type:'openai',docs:'https://api-docs.siliconflow.cn/docs/api/models-get'},
 {id:'moonshot',name:'月之暗面 Moonshot',baseUrl:'https://api.moonshot.cn/v1',type:'openai',docs:'https://platform.moonshot.cn/docs/api/models'},
 {id:'openai',name:'OpenAI',baseUrl:'https://api.openai.com/v1',type:'openai',docs:'https://platform.openai.com/docs/api-reference/models/list'},
 {id:'anthropic',name:'Anthropic · Claude',baseUrl:'https://api.anthropic.com/v1',type:'anthropic',docs:'https://platform.claude.com/docs/en/api/models/list'},
 {id:'gemini',name:'Google · Gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta',type:'gemini',docs:'https://ai.google.dev/api/models'},
 {id:'ollama',name:'Ollama（本地）',baseUrl:'http://127.0.0.1:11434',type:'ollama',docs:'https://docs.ollama.com/api/tags'},
 {id:'custom',name:'自定义接口',baseUrl:'',type:'openai'}
]);
