'use strict';
const http=require('node:http'),https=require('node:https');
const MAX_IMAGE=4*1024*1024,MAX_TOTAL=8*1024*1024;
function imageUrls(text){const found=[];for(const m of String(text).matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi))found.push(m[1]);for(const m of String(text).matchAll(/https?:\/\/[^\s<>"']+?\.(?:png|jpe?g|gif|bmp|webp|svg)(?:\?[^\s<>"']*)?/gi))found.push(m[0]);return [...new Set(found.map(v=>v.replaceAll('&amp;','&')))];}
function download(address,timeoutMs,redirects=0){return new Promise((resolve,reject)=>{
 let url;try{url=new URL(address);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||redirects>3)throw Error();}catch{return reject(Error('image_url_invalid'));}
 const deadline=Date.now()+timeoutMs;let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
 const request=(url.protocol==='https:'?https:http).get(url,{agent:false,headers:{Accept:'image/*','Accept-Encoding':'identity',Referer:'https://mooc1.chaoxing.com/'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();download(new URL(res.headers.location,url).href,Math.max(1,deadline-Date.now()),redirects+1).then(v=>done(null,v),done);return;}
  if(res.statusCode!==200){res.resume();done(Error('image_http_error'));return;}
  const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>MAX_IMAGE){request.destroy();done(Error('image_too_large'));}else chunks.push(chunk);});res.on('error',()=>done(Error('image_read_failed')));res.on('end',()=>done(null,Buffer.concat(chunks)));
 });
 const timer=setTimeout(()=>{request.destroy();done(Error('image_timeout'));},Math.max(1,timeoutMs));request.on('error',()=>done(Error('image_read_failed')));
});}
function toPng(buffer){const {nativeImage}=require('electron');let image=nativeImage.createFromBuffer(buffer);if(image.isEmpty())throw Error('image_decode_failed');const size=image.getSize();if(!size.width||!size.height||size.width*size.height>16000000)throw Error('image_dimensions_invalid');if(size.width<14||size.height<14){const scale=Math.max(14/size.width,14/size.height);image=image.resize({width:Math.ceil(size.width*scale),height:Math.ceil(size.height*scale),quality:'best'});}return image.toPNG();}
async function prepare(question,{deadline=Date.now()+120000,read=download,convert=toPng}={}){
 const options=question.options.map(o=>o.text).join('\n'),urls=[...new Set([...imageUrls(question.title),...imageUrls(options)])].slice(0,16);
 const loaded=new Map();let bytes=0;
 // Limit image work independently from the user's question-search concurrency.
 for(let i=0;i<urls.length&&Date.now()<deadline;i+=2){await Promise.all(urls.slice(i,i+2).map(async url=>{try{const buffer=await read(url,Math.min(10000,Math.max(1,deadline-Date.now()))),png=convert(buffer);if(png.length>MAX_IMAGE||bytes+png.length>MAX_TOTAL)return;bytes+=png.length;loaded.set(url,'data:image/png;base64,'+png.toString('base64'));}catch{}}));}
 const images=[],replacements=new Map();for(const url of urls)if(loaded.has(url)){images.push(loaded.get(url));replacements.set(url,' [图片'+images.length+'] ');}
 const substitute=text=>{for(const [url,label]of replacements){text=text.split(url).join(label).split(url.replaceAll('&','&amp;')).join(label);}return text;};
 return images.length?{images,suggestion_title:substitute(question.title),suggestion_options:substitute(options)}:{images:[]};
}
module.exports={prepare,imageUrls,download,toPng};
