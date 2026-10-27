const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const ux=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8');
let template=ux.match(/<template>([\s\S]*?)<\/template>/)[1];
let css=ux.match(/<style>([\s\S]*?)<\/style>/)[1];
css=css.replace("/common/board.png",'data:image/png;base64,'+fs.readFileSync(path.join(root,'src/common/board.png')).toString('base64'));
const engine=fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace(/export /g,'');
const ai=fs.readFileSync(path.join(root,'src/common/ai.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
css += '\n#watch .piece { border-style:solid; }';
const controller=ux.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replace('export default','const definition =');
const html=String.raw`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>腕上象棋 · 336×480 交互预览</title>
<style>body{margin:0;background:#e7e3d9;font-family:'Microsoft YaHei',sans-serif;color:#233c33;display:flex;justify-content:center;gap:48px;align-items:center;min-height:100vh}aside{max-width:310px}h1{font-size:32px;margin-bottom:12px}p{line-height:1.8}#watch{box-shadow:0 12px 44px #0005;border:10px solid #26332e;border-radius:34px;overflow:hidden;width:336px;height:480px}#watch *{box-sizing:border-box;flex-shrink:0}#watch div{display:flex}#watch text{display:block;white-space:pre-line}#watch input{border:0;font-family:inherit;cursor:pointer;padding:0}#watch .piece{line-height:28px}#watch .hint{line-height:30px}#watch .heading{line-height:28px}#watch .cell{cursor:pointer}aside small{color:#566b63}@media(max-width:760px){body{flex-direction:column;gap:18px;padding:24px 0}aside{order:2}}
${css}</style><aside><small>小米手环 10 Pro · M2551B1</small><h1>腕上象棋</h1><p>完整 9×10 棋盘。<br>选棋子 → 点落点 → 确认落子。</p><p>五关人机 / 双人轮流<br>自由选关 · 悔棋 · 自动续局</p><small>这是复用应用界面与逻辑的浏览器预览，<br>不能代替手环上的实际运行验证。<br>调试消息在这里仅输出到浏览器控制台。</small></aside><main id="watch"></main><template id="source">${template}</template>
<script>
${engine}
${ai}
const storage={get(o){setTimeout(()=>{try{o.success(localStorage.getItem(o.key)||'');}catch(e){o.fail();}},0);},set(o){try{localStorage.setItem(o.key,o.value);o.success();}catch(e){o.fail();}}};
const interconnect={instance(){return {send(o){console.log('[preview interconnect]',o.data);}};}};
const brightness={setKeepScreenOn(o){console.log('[preview keep screen]',o.keepScreenOn);if(o.success)o.success();}};
${controller}
const page=definition;Object.assign(page,page.private);window.chessPage=page;
const nativeTimer=window.setTimeout.bind(window);window.setTimeout=(fn,ms)=>nativeTimer(()=>{fn();render();},ms);
function expr(s,locals){return Function('p','l','with(p){with(l){return ('+s+');}}')(page,locals);}
function interpolate(s,locals){return s.replace(/{{([\s\S]*?)}}/g,(_,e)=>String(expr(e,locals)));}
function node(source,locals,skipFor){
 if(source.nodeType===3)return document.createTextNode(interpolate(source.textContent,locals));
 if(source.nodeType!==1)return document.createTextNode('');
 if(source.hasAttribute('for')&&!skipFor){const m=source.getAttribute('for').match(/(\w+) in (.+)/);const f=document.createDocumentFragment();for(const item of expr(m[2],locals))f.appendChild(node(source,{...locals,[m[1]]:item},true));return f;}
 if(source.hasAttribute('if')&&!expr(source.getAttribute('if').slice(2,-2),locals))return document.createTextNode('');
 if(source.tagName.toLowerCase()==='block'){const f=document.createDocumentFragment();for(const c of source.childNodes)f.appendChild(node(c,locals,false));return f;}
 const el=document.createElement(source.tagName.toLowerCase()==='image'?'img':source.tagName.toLowerCase());
 for(const a of source.attributes){if(['if','for','tid'].includes(a.name))continue;if(a.name==='show'){if(!expr(a.value.slice(2,-2),locals))el.style.visibility='hidden';}else if(a.name==='onclick'||a.name==='onerror'){el[a.name]=()=>{const cmd=a.value.includes('(')?a.value:a.value+'()';expr(cmd,locals);};}else {let value=interpolate(a.value,locals);if(a.name==='src'&&value.startsWith('/common/'))value='../src'+value;el.setAttribute(a.name,value);}}
 for(const c of source.childNodes)el.appendChild(node(c,locals,false));return el;
}
function render(){const host=document.getElementById('watch');host.replaceChildren(node(document.getElementById('source').content.firstElementChild,{},false));}
for(const name of Object.keys(page)){if(typeof page[name]==='function'){const fn=page[name];page[name]=function(...args){const result=fn.apply(page,args);render();return result;};}}
page.onInit();page.onShow();render();
document.addEventListener('visibilitychange',()=>document.hidden?page.onHide():page.onShow());
</script></html>`;
fs.mkdirSync(path.join(root,'preview'),{recursive:true});
fs.writeFileSync(path.join(root,'preview/index.html'),html);
console.log('Created preview/index.html from the application template and controller');
