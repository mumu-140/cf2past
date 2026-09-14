function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function nonceAttr(nonce: string): string {
  return escapeHtml(nonce);
}

function themeBootstrap(nonce: string): string {
  return `<script nonce="${nonceAttr(nonce)}">if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'</script>`;
}

const AUTH_STYLE = `<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--surface:#161616;--border:#262626;--text:#e8e8e8;--muted:#666;--accent:#3b82f6;--accent-hover:#2563eb;--error:#ef4444;--error-bg:#1c1017;--error-border:#3b1520}
[data-theme=light]{--bg:#f5f5f5;--surface:#fff;--border:#e0e0e0;--text:#1a1a1a;--muted:#888;--accent:#2563eb;--accent-hover:#1d4ed8;--error:#dc2626;--error-bg:#fef2f2;--error-border:#fecaca}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:var(--surface);padding:2.5rem;border-radius:12px;width:100%;max-width:340px;border:1px solid var(--border)}
h1{font-size:1.4rem;margin-bottom:.4rem;font-weight:700;letter-spacing:-.02em}.sub{font-size:.8rem;color:var(--muted);margin-bottom:2rem}
input{width:100%;padding:.75rem 1rem;margin-bottom:.75rem;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:.9rem;transition:border-color .15s}
input:focus{outline:none;border-color:var(--accent)}
button{width:100%;padding:.75rem;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;font-weight:600;transition:background .15s}button:hover{background:var(--accent-hover)}
.error{color:var(--error);font-size:.8rem;margin-bottom:.75rem;padding:.5rem .75rem;background:var(--error-bg);border-radius:6px;border:1px solid var(--error-border)}
</style>`;

export function loginPage(error: string | undefined, nonce: string): string {
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past</title>
${AUTH_STYLE}
${themeBootstrap(nonce)}
</head><body>
<div class="card"><h1>cf2past</h1><p class="sub">跨设备实时剪贴板</p>
${errorHtml}
<form method="POST" action="/login">
<input name="username" placeholder="用户名" autocomplete="username" required autofocus>
<input name="password" type="password" placeholder="密码" autocomplete="current-password" required>
<button type="submit">登录</button>
</form></div></body></html>`;
}

export function setupPage(error: string | undefined, nonce: string): string {
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past - 初始化</title>
${AUTH_STYLE}
${themeBootstrap(nonce)}
</head><body>
<div class="card"><h1>cf2past</h1><p class="sub">首次使用，创建管理员账号</p>
${errorHtml}
<form method="POST" action="/setup">
<input name="username" placeholder="用户名" autocomplete="username" required autofocus>
<input name="password" type="password" placeholder="密码（至少8位）" autocomplete="new-password" required minlength="8">
<button type="submit">创建账号</button>
</form></div></body></html>`;
}

export function mainPage(room: string, nonce: string): string {
  const safeRoom = escapeHtml(room);
  const roomJson = JSON.stringify(room).replace(/</g, '\\u003c');
  const safeNonce = nonceAttr(nonce);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past${room !== 'default' ? ' / ' + safeRoom : ''}</title>
<script src="https://cdn.jsdelivr.net/npm/marked@18.0.12/lib/marked.umd.js" integrity="sha384-TuL/7aNYXEDWjlcHi2CR+Een2A5pigrtJ97Tmx3WG69mx5kCSp8yKHRISW9xSmgq" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js" integrity="sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N" crossorigin="anonymous"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--surface:#161616;--border:#262626;--border2:#333;--text:#e8e8e8;--muted:#666;--muted2:#444;--accent:#3b82f6;--accent-hover:#2563eb;--pin:#f59e0b;--pin-bg:#2a2008;--pv:#22c55e;--pv-bg:#0a1f0a;--card:#1c1c1c;--card-hover:#222;--editor-bg:#0c0c0c;--error:#ef4444}
[data-theme=light]{--bg:#f8f9fa;--surface:#fff;--border:#e5e7eb;--border2:#d1d5db;--text:#1f2937;--muted:#6b7280;--muted2:#9ca3af;--accent:#2563eb;--accent-hover:#1d4ed8;--pin:#d97706;--pin-bg:#fffbeb;--pv:#16a34a;--pv-bg:#f0fdf4;--card:#f3f4f6;--card-hover:#e5e7eb;--editor-bg:#fff}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;padding:.6rem 1rem;background:var(--surface);border-bottom:1px solid var(--border);gap:.6rem}.dot{width:8px;height:8px;border-radius:50%;background:#ef4444;transition:background .3s;flex-shrink:0}.dot.on{background:#22c55e}.room-name{font-size:.82rem;font-weight:600;color:var(--muted)}.spacer{flex:1}
.btn{background:none;border:1px solid var(--border2);color:var(--muted);padding:.35rem .7rem;border-radius:6px;cursor:pointer;font-size:.75rem;transition:all .15s;white-space:nowrap}.btn:hover{border-color:var(--accent);color:var(--accent)}.btn.active{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
.mode-group{display:flex;gap:2px;border:1px solid var(--border2);border-radius:6px;overflow:hidden}.mode-group .mbtn{background:none;border:none;color:var(--muted);padding:.35rem .6rem;cursor:pointer;font-size:.72rem;transition:all .15s}.mode-group .mbtn:hover{color:var(--text)}.mode-group .mbtn.active{background:var(--accent);color:#fff}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative}#editor{flex:1;padding:1.25rem;background:var(--editor-bg);border:none;color:var(--text);font-family:'SF Mono',Monaco,'Fira Code',monospace;font-size:.88rem;line-height:1.7;resize:none;outline:none;display:block}#editor::placeholder{color:var(--muted2)}
#preview{flex:1;padding:1.25rem;background:var(--editor-bg);overflow-y:auto;display:none;font-size:.9rem;line-height:1.7}#preview h1,#preview h2,#preview h3{margin:1em 0 .5em;font-weight:700}#preview h1{font-size:1.4em}#preview h2{font-size:1.2em}#preview h3{font-size:1.05em}#preview p{margin:.5em 0}#preview code{background:var(--card);padding:.15em .4em;border-radius:4px;font-size:.85em;font-family:'SF Mono',Monaco,monospace}#preview pre{background:var(--card);padding:1rem;border-radius:8px;overflow-x:auto;margin:.75em 0}#preview pre code{background:none;padding:0}#preview ul,#preview ol{padding-left:1.5em;margin:.5em 0}#preview blockquote{border-left:3px solid var(--accent);padding-left:1em;color:var(--muted);margin:.5em 0}#preview a{color:var(--accent)}#preview img{max-width:100%;border-radius:8px}
.panel{position:fixed;top:0;right:-420px;width:420px;max-width:92vw;height:100vh;background:var(--surface);border-left:1px solid var(--border);transition:right .25s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;z-index:100}.panel.open{right:0}.panel-head{display:flex;align-items:center;padding:.9rem 1.25rem;gap:.6rem;border-bottom:1px solid var(--border)}.panel-head h2{font-size:.88rem;font-weight:600;flex:1}.search-row{display:flex;gap:.5rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)}.search-box{flex:1;padding:.55rem .85rem;background:var(--bg);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:.8rem;outline:none;transition:border-color .15s}.search-box:focus{border-color:var(--accent)}.list{flex:1;overflow-y:auto;padding:.75rem 1rem}
.item{position:relative;padding:.85rem 8.75rem .78rem 1rem;min-height:4.25rem;margin-bottom:.5rem;background:var(--card);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s}.item:hover{border-color:var(--border2);background:var(--card-hover)}.item.pinned{border-color:color-mix(in srgb,var(--pin) 30%,transparent)}.item.preserved{border-color:color-mix(in srgb,var(--pv) 30%,transparent)}.item-content{font-size:.8rem;color:var(--text);line-height:1.4;max-height:3.6em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:.4rem;word-break:break-all;opacity:.85}.item-meta{display:flex;align-items:center;gap:.5rem;font-size:.68rem;color:var(--muted)}.item-actions{position:absolute;top:.65rem;right:.75rem;display:flex;gap:.35rem;opacity:0;transition:opacity .15s;z-index:2}.item:hover .item-actions{opacity:1}@media(pointer:coarse){.item-actions{opacity:1}}
.act{appearance:none;-webkit-appearance:none;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:7px;border:1px solid var(--border2);background:var(--surface);color:var(--muted);cursor:pointer;font-size:.72rem;font-weight:700;transition:background .15s,color .15s,border-color .15s,transform .15s;-webkit-tap-highlight-color:transparent;user-select:none;line-height:1;text-align:center;position:relative;z-index:3}.act:hover{background:var(--card-hover);color:var(--text);border-color:var(--accent)}.act:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.act:active{transform:scale(.94)}.act.active{color:var(--pin);background:var(--pin-bg);border-color:var(--pin)}.act.pv.active{color:var(--pv);background:var(--pv-bg);border-color:var(--pv)}.act.del:hover{color:#ef4444;border-color:#ef4444}.badge{display:inline-block;padding:.1rem .35rem;border-radius:3px;font-size:.62rem;font-weight:500}.badge-pin{background:var(--pin-bg);color:var(--pin)}.badge-pv{background:var(--pv-bg);color:var(--pv)}.empty{text-align:center;color:var(--muted);padding:2rem;font-size:.82rem}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;opacity:0;pointer-events:none;transition:opacity .25s}.overlay.open{opacity:1;pointer-events:auto}
@media(max-width:640px){header{gap:.35rem;padding:.5rem}.room-name{max-width:22vw;overflow:hidden;text-overflow:ellipsis}.btn{padding:.32rem .5rem}.mode-group .mbtn{padding:.32rem .45rem}}
</style>
${themeBootstrap(nonce)}
</head><body>
<header>
<div class="dot" id="dot"></div><span class="room-name">${safeRoom}</span><span class="spacer"></span>
<div class="mode-group"><button class="mbtn active" id="btn-md" type="button">MD</button><button class="mbtn" id="btn-txt" type="button">TXT</button><button class="mbtn" id="btn-preview" type="button">预览</button></div>
<button class="btn" id="btn-new" type="button">新建</button><button class="btn" id="btn-history" type="button">历史</button><button class="btn" id="theme-btn" type="button">☀</button><button class="btn" id="logout-btn" type="button">退出</button>
</header>
<div class="main"><textarea id="editor" placeholder="输入内容，自动同步到其他设备..." autofocus></textarea><div id="preview"></div></div>
<div class="overlay" id="overlay"></div>
<div class="panel" id="panel"><div class="panel-head"><h2>历史记录</h2><button class="btn" id="history-refresh" type="button">刷新</button><button class="btn" id="history-close" type="button">关闭</button></div><div class="search-row"><input class="search-box" id="search" placeholder="搜索..."></div><div class="list" id="list"></div></div>
<script nonce="${safeNonce}">
const room=${roomJson};
const roomPath=encodeURIComponent(room);
const editor=document.getElementById('editor');
const dot=document.getElementById('dot');
const preview=document.getElementById('preview');
const panel=document.getElementById('panel');
const overlay=document.getElementById('overlay');
const list=document.getElementById('list');
const search=document.getElementById('search');
let ws=null;
let sendTimer=null;
let searchTimer=null;
let reconnectTimer=null;
let reconnectAttempt=0;
let format=localStorage.getItem('format')||'md';

function renderPreview(text){
  const parsed=marked.parse(text||'');
  preview.innerHTML=DOMPurify.sanitize(parsed,{
    USE_PROFILES:{html:true},
    FORBID_TAGS:['style','iframe','object','embed','form','input','button'],
    FORBID_ATTR:['style']
  });
  preview.querySelectorAll('a[href]').forEach(function(anchor){
    const target=new URL(anchor.href,location.href);
    if(target.origin!==location.origin){
      anchor.target='_blank';
      anchor.rel='noopener noreferrer nofollow';
    }
  });
}

function toggleTheme(){
  const theme=document.documentElement.dataset.theme==='light'?'':'light';
  document.documentElement.dataset.theme=theme;
  localStorage.setItem('theme',theme||'dark');
  document.getElementById('theme-btn').textContent=theme==='light'?'☾':'☀';
}

document.getElementById('theme-btn').textContent=localStorage.getItem('theme')==='light'?'☾':'☀';

function setFormat(next){
  format=next;
  localStorage.setItem('format',next);
  document.querySelectorAll('.mode-group .mbtn').forEach(function(button){button.classList.remove('active');});
  const active=document.getElementById('btn-'+next);
  if(active)active.classList.add('active');
  if(next==='preview'){
    editor.style.display='none';
    preview.style.display='block';
    renderPreview(editor.value);
  }else{
    editor.style.display='block';
    preview.style.display='none';
    editor.focus();
  }
}

function scheduleReconnect(){
  if(reconnectTimer!==null)return;
  const base=Math.min(10000,500*Math.pow(2,reconnectAttempt++));
  const jitter=Math.floor(Math.random()*250);
  reconnectTimer=setTimeout(function(){reconnectTimer=null;connect();},base+jitter);
}

function connect(){
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(protocol+'//'+location.host+'/api/ws/'+roomPath);
  ws.onopen=function(){
    dot.classList.add('on');
    reconnectAttempt=0;
    if(reconnectTimer!==null){clearTimeout(reconnectTimer);reconnectTimer=null;}
  };
  ws.onclose=function(){dot.classList.remove('on');scheduleReconnect();};
  ws.onerror=function(){dot.classList.remove('on');};
  ws.onmessage=function(event){
    const text=typeof event.data==='string'?event.data:'';
    const selection=editor.selectionStart||0;
    editor.value=text;
    const cursor=Math.min(selection,text.length);
    editor.selectionStart=cursor;
    editor.selectionEnd=cursor;
    if(format==='preview')renderPreview(text);
  };
}

editor.addEventListener('input',function(){
  if(sendTimer!==null)clearTimeout(sendTimer);
  sendTimer=setTimeout(function(){
    sendTimer=null;
    if(ws&&ws.readyState===WebSocket.OPEN)ws.send(editor.value);
  },300);
});

async function newSession(){
  const response=await fetch('/api/new/'+roomPath,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({content:editor.value})
  });
  if(!response.ok){console.error('New session failed',response.status);return;}
  editor.focus();
}

function setPanel(open){
  panel.classList.toggle('open',open);
  overlay.classList.toggle('open',open);
  if(open)loadHistory(search.value);
}

function togglePanel(){setPanel(!panel.classList.contains('open'));}

function timeAgo(value){
  const elapsed=Date.now()-new Date(value+'Z').getTime();
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return'刚刚';
  if(minutes<60)return minutes+'分钟前';
  const hours=Math.floor(minutes/60);
  if(hours<24)return hours+'小时前';
  return Math.floor(hours/24)+'天前';
}

function badge(label,className){
  const element=document.createElement('span');
  element.className='badge '+className;
  element.textContent=label;
  return element;
}

function actionButton(label,action,id,classes,title){
  const button=document.createElement('button');
  button.type='button';
  button.className=classes;
  button.dataset.action=action;
  button.dataset.id=String(id);
  button.title=title;
  button.setAttribute('aria-label',title+'历史记录');
  button.textContent=label;
  return button;
}

function historyElement(item){
  const root=document.createElement('div');
  root.className='item'+(item.pinned?' pinned':'')+(item.preserved?' preserved':'');
  root.dataset.id=String(item.id);

  const actions=document.createElement('div');
  actions.className='item-actions';
  actions.appendChild(actionButton('顶','pin',item.id,'act'+(item.pinned?' active':''),'置顶'));
  actions.appendChild(actionButton('留','preserve',item.id,'act pv'+(item.preserved?' active':''),'保留'));
  actions.appendChild(actionButton('删','delete',item.id,'act del','删除'));

  const content=document.createElement('div');
  content.className='item-content';
  content.textContent=String(item.content||'');

  const meta=document.createElement('div');
  meta.className='item-meta';
  const time=document.createElement('span');
  time.textContent=timeAgo(item.updated_at);
  meta.appendChild(time);
  if(item.pinned)meta.appendChild(badge('置顶','badge-pin'));
  if(item.preserved)meta.appendChild(badge('保留','badge-pv'));

  root.append(actions,content,meta);
  return root;
}

async function loadHistory(query){
  const q=typeof query==='string'?query:'';
  const response=await fetch('/api/history/'+roomPath+(q?'?q='+encodeURIComponent(q):''));
  if(!response.ok){console.error('History load failed',response.status);return;}
  const items=await response.json();
  list.replaceChildren();
  if(!Array.isArray(items)||items.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.textContent='暂无历史记录';
    list.appendChild(empty);
    return;
  }
  items.forEach(function(item){list.appendChild(historyElement(item));});
}

async function restoreHistory(id){
  const response=await fetch('/api/restore/'+roomPath+'/'+id,{method:'POST'});
  if(!response.ok){console.error('Restore failed',response.status);return;}
  setPanel(false);
}

async function mutateHistory(id,action){
  let response;
  if(action==='delete'){
    response=await fetch('/api/history/'+roomPath+'/'+id,{method:'DELETE'});
  }else{
    response=await fetch('/api/history/'+roomPath+'/'+id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:action})
    });
  }
  if(!response.ok){console.error('History mutation failed',response.status);return;}
  await loadHistory(search.value);
}

list.addEventListener('click',function(event){
  if(!(event.target instanceof Element))return;
  const actionTarget=event.target.closest('[data-action][data-id]');
  if(actionTarget){
    const id=Number(actionTarget.getAttribute('data-id'));
    const action=actionTarget.getAttribute('data-action');
    if(Number.isSafeInteger(id)&&id>0&&action)mutateHistory(id,action);
    return;
  }
  const item=event.target.closest('.item[data-id]');
  if(!item)return;
  const id=Number(item.getAttribute('data-id'));
  if(Number.isSafeInteger(id)&&id>0)restoreHistory(id);
});

search.addEventListener('input',function(){
  if(searchTimer!==null)clearTimeout(searchTimer);
  searchTimer=setTimeout(function(){searchTimer=null;loadHistory(search.value);},300);
});

document.getElementById('btn-md').addEventListener('click',function(){setFormat('md');});
document.getElementById('btn-txt').addEventListener('click',function(){setFormat('txt');});
document.getElementById('btn-preview').addEventListener('click',function(){setFormat('preview');});
document.getElementById('btn-new').addEventListener('click',newSession);
document.getElementById('btn-history').addEventListener('click',togglePanel);
document.getElementById('theme-btn').addEventListener('click',toggleTheme);
document.getElementById('history-refresh').addEventListener('click',function(){loadHistory(search.value);});
document.getElementById('history-close').addEventListener('click',function(){setPanel(false);});
overlay.addEventListener('click',function(){setPanel(false);});
document.getElementById('logout-btn').addEventListener('click',async function(){
  const response=await fetch('/logout',{method:'POST'});
  if(response.ok)location.assign('/login');
  else console.error('Logout failed',response.status);
});
document.addEventListener('keydown',function(event){if(event.key==='Escape'&&panel.classList.contains('open'))setPanel(false);});

setFormat(format);
connect();
</script></body></html>`;
}
