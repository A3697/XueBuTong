'use strict';
const isManager=id=>/^(scriptcat|tampermonkey)(?:[-_].*)?$/i.test(id||'');
const isSoutijiang=id=>id==='daxuesoutijiang';
const isOcsScript=script=>script?.fusionOcsManaged===true||script?.info?.name==='OCS 网课助手';
function normalize(value){
 if(value===undefined||value===null)return 'ocs';
 if(value!=='ocs'&&value!=='soutijiang')throw Error('脚本选择无效');
 return value;
}
function state({selected,scripts=[],extensions=[]}={}){
 const requested=normalize(selected),ocs=scripts.some(isOcsScript)&&extensions.some(item=>isManager(item.id)),soutijiang=extensions.some(item=>isSoutijiang(item.id));
 const effective=ocs&&soutijiang?requested:soutijiang?'soutijiang':'ocs';
 return {requested,selected:effective,ocs,soutijiang,canChoose:ocs&&soutijiang};
}
module.exports={normalize,state,isManager,isSoutijiang,isOcsScript};
