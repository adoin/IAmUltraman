import {messages} from './i18n-catalog.js';

export const LANGUAGES=['zh','en','ja'];
const storageKey='ultra-language';
export function normalizeLocale(value){return LANGUAGES.includes(value)?value:'zh';}
let locale='zh';
try{locale=normalizeLocale(localStorage.getItem(storageKey));}catch{}
export const getLocale=()=>locale;

/** Translate source copy, including the live values used by the combat HUD. */
export function translate(source,language=locale){
  const value=String(source),lang=normalizeLocale(language);
  if(lang==='zh')return value;
  const key=value.trim(),entry=messages[key];
  const render=text=>value.slice(0,value.indexOf(key))+text+value.slice(value.indexOf(key)+key.length);
  if(entry)return render(entry[lang]);
  const pick=(en,ja)=>lang==='en'?en:ja;
  const tr=s=>translate(s,lang);
  let m;
  if((m=key.match(/^守护星星 (\d+)$/)))return render(pick(`Guardian stars ${m[1]}`,`守護の星 ${m[1]}`));
  if((m=key.match(/^第 (\d+) 波 · 新的挑战$/)))return render(pick(`Wave ${m[1]} · A new challenge`,`第${m[1]}波 · 新たな挑戦`));
  if((m=key.match(/^收集了 (\d+) 颗守护星星。(.+)$/)))return render(pick(`Collected ${m[1]} guardian stars. ${tr(m[2])}`,`守護の星を${m[1]}個集めたよ。${tr(m[2])}`));
  if((m=key.match(/^冷却 ([\d.]+) 秒(?: · 伤害 (\d+))?(?: · 按 ([A-Z]))?$/))){
    return render(pick(`Cooldown ${m[1]} s${m[2]?` · Damage ${m[2]}`:''}${m[3]?` · ${m[3]}`:''}`,`クールダウン${m[1]}秒${m[2]?` · ダメージ${m[2]}`:''}${m[3]?` · ${m[3]}`:''}`));
  }
  if((m=key.match(/^防御中(?:，剩余 | )([\d.]+) 秒$/)))return render(pick(`Guarding · ${m[1]} s left`,`防御中 · 残り${m[1]}秒`));
  if((m=key.match(/^(.+) ([\d.]+)s$/))&&messages[m[1]])return render(`${tr(m[1])} ${m[2]}s`);
  if((m=key.match(/^(.+) · (正在蓄力|来了！)$/)))return render(tr(m[1])+pick(m[2]==='正在蓄力'?' · Charging':' · Incoming!',m[2]==='正在蓄力'?' · チャージ中':' · 来るよ！'));
  // Accessibility descriptions combine a skill name and a changing state.
  if(key.includes('，')){const parts=key.split('，');if(parts.every(s=>tr(s)!==s||!/[\u3400-\u9fff]/u.test(s)))return render(parts.map(tr).join(pick(', ','、')));}
  if(key.startsWith('重击来袭，请举盾；'))return render(tr('重击来袭，请举盾；')+tr(key.slice('重击来袭，请举盾；'.length)));
  if(key.endsWith('！')&&messages[key.slice(0,-1)])return render(tr(key.slice(0,-1))+pick('!','！'));
  return value;
}
export const t=translate;

/** Bridge static markup and runtime text without replacing elements or their listeners.
 * Keep the Chinese source separately so switching back never reverse-translates copy.
 */
export function initLanguageUI(doc=document){
  const textSources=new WeakMap(),attributeSources=new WeakMap();
  const attributes=['aria-label','title','alt','content'];
  const excluded=node=>node.parentElement?.closest('script,style,[data-l10n="off"]');
  function localizeText(node){
    if(excluded(node))return;
    let record=textSources.get(node);
    if(!record&&!node.data.trim())return;
    if(!record||node.data!==record.rendered)record={source:node.data};
    const output=t(record.source);record.rendered=output;textSources.set(node,record);
    if(node.data!==output)node.data=output;
  }
  function localizeAttributes(element){
    if(element.closest('[data-l10n="off"]'))return;
    let records=attributeSources.get(element);
    if(!records){records={};attributeSources.set(element,records);}
    for(const attribute of attributes){
      const value=element.getAttribute(attribute);if(value===null)continue;
      let record=records[attribute];
      if(!record||value!==record.rendered)record={source:value};
      const output=t(record.source);record.rendered=output;records[attribute]=record;
      if(value!==output)element.setAttribute(attribute,output);
    }
  }
  function visit(root){
    if(root.nodeType===3){localizeText(root);return;}
    if(root.nodeType!==1&&root.nodeType!==9)return;
    if(root.nodeType===1)localizeAttributes(root);
    const walker=doc.createTreeWalker(root,5); // elements and text, including SVG labels
    while(walker.nextNode()){const node=walker.currentNode;if(node.nodeType===3)localizeText(node);else localizeAttributes(node);}
  }
  const observer=new MutationObserver(changes=>{
    for(const change of changes){
      if(change.type==='characterData')localizeText(change.target);
      else if(change.type==='attributes')localizeAttributes(change.target);
      else for(const node of change.addedNodes)visit(node);
    }
  });
  const observe=()=>observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  function apply(language){
    observer.disconnect();locale=normalizeLocale(language);
    doc.documentElement.lang=locale==='zh'?'zh-CN':locale;
    doc.getElementById('language').value=locale;
    visit(doc);observe();
    try{localStorage.setItem(storageKey,locale);}catch{}
  }
  doc.getElementById('language').addEventListener('change',event=>apply(event.target.value));
  apply(locale);
  return {apply,disconnect:()=>observer.disconnect()};
}
