import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const entries=JSON.parse(fs.readFileSync(path.join(root,'src/data/entries.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'dist/archive/index.html'),'utf8');
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const cardData=[...html.matchAll(/<article class="brief-card"\s[^>]*>/g)].map(match=>Object.fromEntries([...match[0].matchAll(/data-([a-z-]+)="([^"]*)"/g)].map(([,key,value])=>[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),decode(value)])));
assert.equal(cardData.length,entries.length);
for(const entry of entries) {
  assert.equal(cardData.find(card=>card.entryId===entry.id).topic,entry.topics.map(topic=>topic.toLowerCase()).join('|'));
  const brief=fs.readFileSync(path.join(root,'dist/entries',entry.slug,'index.html'),'utf8');
  for(const topic of entry.topics) assert.ok(brief.includes(`/archive/?topic=${topic.toLowerCase()}`));
  for(const source of entry.supportingSources||[]) assert.ok(brief.includes(source.url.replace(/&/g,'&amp;')));
  if(entry.resultType==='recommendations') {
    assert.ok(brief.includes('<h4>Key recommendations</h4>'));
    assert.ok(!brief.includes('<h4>Key quantitative results</h4>'));
  }
  if(!entry.platformRelevance) assert.ok(!brief.includes('<h4>Quanterix or platform relevance</h4>'));
}

// Exercise the real archive controller against generated card metadata, including
// bookmarked topic views and the GitHub Pages mount path. No browser is required.
function element() {
  const listeners={};
  return {dataset:{},hidden:false,children:[],classList:{toggle(){},add(){},remove(){}},
    addEventListener(type,handler){listeners[type]=handler;},fire(type){listeners[type]?.();},
    append(child){this.children.push(child);},set innerHTML(value){this.children=[];},
    setAttribute(){},removeAttribute(){}};
}
function controller(search) {
  const cards=cardData.map(dataset=>({...element(),dataset:{...dataset}}));
  const archive={...element(),querySelectorAll:()=>cards,append(){}};
  const controls=[...html.matchAll(/<select[^>]*name="([^"]+)"[^>]*data-filter[^>]*>([\s\S]*?)<\/select>|<input[^>]*name="([^"]+)"[^>]*data-filter[^>]*>/g)].map(([,selectName,body,inputName])=>{
    const tag=selectName?'select':'input',name=selectName||inputName;
    const values=tag==='select'?[...body.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(([,value,text])=>({value:decode(value),text:decode(text)})):[];
    const control={...element(),name,tagName:tag.toUpperCase(),options:values,closest:()=>({querySelector:()=>({textContent:name})})};
    let value=name==='sort'?'added-desc':'';
    Object.defineProperties(control,{value:{get:()=>value,set:next=>{value=tag==='input'||values.some(option=>option.value===next)?next:'';}},selectedIndex:{get:()=>values.findIndex(option=>option.value===value)}});
    return control;
  });
  assert.ok(controls.some(control=>control.name==='topic'));
  const count=element(),chips=element(),none=element(),clear=element();
  const document={documentElement:element(),addEventListener(){},createElement:element,
    querySelector(selector){
      if(selector==='#adbf-view-state')return {textContent:JSON.stringify({ids:entries.map(entry=>entry.id),status:{}})};
      const control=selector.match(/^\[name="([^"]+)"\]$/);
      if(control)return controls.find(item=>item.name===control[1]);
      return {'[data-archive]':archive,'[data-result-count]':count,'[data-active-filters]':chips,'[data-no-results]':none,'[data-clear-all]':clear}[selector]||null;
    },querySelectorAll(selector){return selector==='[data-filter]'?controls:[];}};
  let lastURL='';
  const context=vm.createContext({window:{setInterval(){},addEventListener(){}},document,URL,URLSearchParams,Intl,Date,location:{search,pathname:'/ad-biomarker-field-brief/archive/',href:'https://example.test/ad-biomarker-field-brief/archive/'+search},history:{replaceState(_state,_title,url){lastURL=url;}}});
  vm.runInContext(fs.readFileSync(path.join(root,'src/view-state.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/app.js'),'utf8'),context);
  return {visible:()=>cards.filter(card=>!card.hidden).map(card=>card.dataset.entryId).sort(),change(name,value){const control=controls.find(item=>item.name===name);control.value=value;control.fire(control.tagName==='INPUT'?'input':'change');},clear(){clear.fire('click');},count,none,chips,url:()=>lastURL};
}
const expected=topic=>entries.filter(entry=>entry.topics.includes(topic)).map(entry=>entry.id).sort();
for(const topic of ['Biomarkers','Guidelines','Management'])assert.deepEqual(controller(`?topic=${topic.toLowerCase()}`).visible(),expected(topic));
const view=controller('?topic=management');
view.change('topic','guidelines');
assert.deepEqual(view.visible(),expected('Guidelines'));
assert.equal(view.url(),'/ad-biomarker-field-brief/archive/?topic=guidelines');
view.change('biomarker','p-tau217');
assert.deepEqual(view.visible(),[]);
assert.equal(view.none.hidden,false);
view.clear();
assert.deepEqual(view.visible(),entries.map(entry=>entry.id).sort());
assert.equal(view.chips.children.length,0);
assert.equal(view.url(),'/ad-biomarker-field-brief/archive/');
view.change('topic','management');
view.change('q','agitation');
assert.ok(view.visible().includes('fda-auvelity-ad-agitation-2026-04-30'));
assert.ok(!view.visible().includes('fda-bla761375-s001'));
const mixed=entries.find(entry=>entry.topics.includes('Biomarkers')&&entry.topics.includes('Management'));
assert.ok(mixed,'Keep a real overlapping-topic regression case.');
assert.ok(expected('Biomarkers').includes(mixed.id)&&expected('Management').includes(mixed.id));
console.log('Passed topic tags, bookmarked filters, overlapping topics, combined search, empty results, clear/reset, and guidance rendering checks.');
