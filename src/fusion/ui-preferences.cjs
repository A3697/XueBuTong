'use strict';
const fs = require('node:fs'), path = require('node:path');
const {uidOf} = require('./controller.cjs');
const CourseFilter=require(fs.existsSync(path.join(__dirname,'../star-panel/course-filter.js'))?'../star-panel/course-filter.js':'../star-runtime/web/dist/course-filter.js');
const RANGES={panelColumnRatio:[.20,.65,.26],panelQueueRatio:[.20,.65,.35],panelTaskRatio:[.20,.80,.60]};
function normalize(value={}) {
  const result={hideUpdatePopup:value.hideUpdatePopup===true,courseFilter:CourseFilter.normalize(value.courseFilter)};
  for(const[key,[min,max,initial]]of Object.entries(RANGES)){const ratio=value[key];result[key]=typeof ratio==='number'&&Number.isFinite(ratio)?Math.max(min,Math.min(max,ratio)):initial;}
  return result;
}
class HtmlPreferences {
  constructor(root) {
    this.file = path.join(root, 'bridge-data', 'html-preferences.json');
    this.accounts = Object.create(null);
    if (fs.existsSync(this.file)) {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const [uid, item] of Object.entries(saved.accounts || {})) {
        try { uidOf(uid); this.accounts[uid] = normalize(item); } catch {}
      }
    }
  }
  get(uid) { uidOf(uid); return normalize(this.accounts[uid]); }
  persist() {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({schema:1, accounts:this.accounts}, null, 2), 'utf8');
    fs.renameSync(this.file + '.tmp', this.file);
  }
  set(uid, hidden) {
    uidOf(uid);
    if(typeof hidden==='boolean')hidden={hideUpdatePopup:hidden};
    if(!hidden||typeof hidden!=='object'||Array.isArray(hidden)||Object.keys(hidden).some(key=>key!=='hideUpdatePopup'&&key!=='courseFilter'&&!Object.hasOwn(RANGES,key))||'hideUpdatePopup' in hidden&&typeof hidden.hideUpdatePopup!=='boolean'||Object.entries(RANGES).some(([key,[min,max]])=>key in hidden&&(typeof hidden[key]!=='number'||!Number.isFinite(hidden[key])||hidden[key]<min||hidden[key]>max)))throw Error('控制面板布局设置无效');
    const next = {...this.accounts, [uid]:normalize({...this.get(uid),...hidden})};
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({schema:1, accounts:next}, null, 2), 'utf8');
    fs.renameSync(this.file + '.tmp', this.file); this.accounts = next;
    return this.get(uid);
  }
}
module.exports = {HtmlPreferences,normalize};
