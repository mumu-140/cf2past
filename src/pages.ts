export function loginPage(error?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--surface:#161616;--border:#262626;--text:#e8e8e8;--muted:#666;--accent:#3b82f6;--accent-hover:#2563eb;--error:#ef4444;--error-bg:#1c1017;--error-border:#3b1520}
[data-theme=light]{--bg:#f5f5f5;--surface:#fff;--border:#e0e0e0;--text:#1a1a1a;--muted:#888;--accent:#2563eb;--accent-hover:#1d4ed8;--error:#dc2626;--error-bg:#fef2f2;--error-border:#fecaca}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:var(--surface);padding:2.5rem;border-radius:12px;width:100%;max-width:340px;border:1px solid var(--border)}
h1{font-size:1.4rem;margin-bottom:.4rem;font-weight:700;letter-spacing:-.02em}
.sub{font-size:.8rem;color:var(--muted);margin-bottom:2rem}
input{width:100%;padding:.75rem 1rem;margin-bottom:.75rem;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:.9rem;transition:border-color .15s}
input:focus{outline:none;border-color:var(--accent)}
button{width:100%;padding:.75rem;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;font-weight:600;transition:background .15s}
button:hover{background:var(--accent-hover)}
.error{color:var(--error);font-size:.8rem;margin-bottom:.75rem;padding:.5rem .75rem;background:var(--error-bg);border-radius:6px;border:1px solid var(--error-border)}
</style>
<script>if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'</script>
</head><body>
<div class="card"><h1>cf2past</h1><p class="sub">跨设备实时剪贴板</p>
${error ? `<div class="error">${error}</div>` : ''}
<form method="POST" action="/login">
<input name="username" placeholder="用户名" autocomplete="username" required autofocus>
<input name="password" type="password" placeholder="密码" autocomplete="current-password" required>
<button type="submit">登录</button>
</form></div></body></html>`;
}

export function setupPage(error?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past - 初始化</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--surface:#161616;--border:#262626;--text:#e8e8e8;--muted:#666;--accent:#3b82f6;--accent-hover:#2563eb;--error:#ef4444;--error-bg:#1c1017;--error-border:#3b1520}
[data-theme=light]{--bg:#f5f5f5;--surface:#fff;--border:#e0e0e0;--text:#1a1a1a;--muted:#888;--accent:#2563eb;--accent-hover:#1d4ed8;--error:#dc2626;--error-bg:#fef2f2;--error-border:#fecaca}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:var(--surface);padding:2.5rem;border-radius:12px;width:100%;max-width:340px;border:1px solid var(--border)}
h1{font-size:1.4rem;margin-bottom:.4rem;font-weight:700;letter-spacing:-.02em}
.sub{font-size:.8rem;color:var(--muted);margin-bottom:2rem}
input{width:100%;padding:.75rem 1rem;margin-bottom:.75rem;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:.9rem;transition:border-color .15s}
input:focus{outline:none;border-color:var(--accent)}
button{width:100%;padding:.75rem;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;font-weight:600;transition:background .15s}
button:hover{background:var(--accent-hover)}
.error{color:var(--error);font-size:.8rem;margin-bottom:.75rem;padding:.5rem .75rem;background:var(--error-bg);border-radius:6px;border:1px solid var(--error-border)}
</style>
<script>if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'</script>
</head><body>
<div class="card"><h1>cf2past</h1><p class="sub">首次使用，创建管理员账号</p>
${error ? `<div class="error">${error}</div>` : ''}
<form method="POST" action="/setup">
<input name="username" placeholder="用户名" autocomplete="username" required autofocus>
<input name="password" type="password" placeholder="密码（至少4位）" autocomplete="new-password" required minlength="4">
<button type="submit">创建账号</button>
</form></div></body></html>`;
}

export function mainPage(room: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past${room !== 'default' ? ' / ' + room : ''}</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--surface:#161616;--border:#262626;--border2:#333;--text:#e8e8e8;--muted:#666;--muted2:#444;--accent:#3b82f6;--accent-hover:#2563eb;--pin:#f59e0b;--pin-bg:#2a2008;--pv:#22c55e;--pv-bg:#0a1f0a;--card:#1c1c1c;--card-hover:#222;--editor-bg:#0c0c0c}
[data-theme=light]{--bg:#f8f9fa;--surface:#fff;--border:#e5e7eb;--border2:#d1d5db;--text:#1f2937;--muted:#6b7280;--muted2:#9ca3af;--accent:#2563eb;--accent-hover:#1d4ed8;--pin:#d97706;--pin-bg:#fffbeb;--pv:#16a34a;--pv-bg:#f0fdf4;--card:#f3f4f6;--card-hover:#e5e7eb;--editor-bg:#fff}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;padding:.6rem 1rem;background:var(--surface);border-bottom:1px solid var(--border);gap:.6rem}
.dot{width:8px;height:8px;border-radius:50%;background:#ef4444;transition:background .3s;flex-shrink:0}
.dot.on{background:#22c55e}
.room-name{font-size:.82rem;font-weight:600;color:var(--muted)}
.spacer{flex:1}
.btn{background:none;border:1px solid var(--border2);color:var(--muted);padding:.35rem .7rem;border-radius:6px;cursor:pointer;font-size:.75rem;transition:all .15s;white-space:nowrap}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.active{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
.mode-group{display:flex;gap:2px;border:1px solid var(--border2);border-radius:6px;overflow:hidden}
.mode-group .mbtn{background:none;border:none;color:var(--muted);padding:.35rem .6rem;cursor:pointer;font-size:.72rem;transition:all .15s}
.mode-group .mbtn:hover{color:var(--text)}
.mode-group .mbtn.active{background:var(--accent);color:#fff}

.main{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative}
#editor{flex:1;padding:1.25rem;background:var(--editor-bg);border:none;color:var(--text);font-family:'SF Mono',Monaco,'Fira Code',monospace;font-size:.88rem;line-height:1.7;resize:none;outline:none;display:block}
#editor::placeholder{color:var(--muted2)}
#preview{flex:1;padding:1.25rem;background:var(--editor-bg);overflow-y:auto;display:none;font-size:.9rem;line-height:1.7}
#preview h1,#preview h2,#preview h3{margin:1em 0 .5em;font-weight:700}
#preview h1{font-size:1.4em}#preview h2{font-size:1.2em}#preview h3{font-size:1.05em}
#preview p{margin:.5em 0}
#preview code{background:var(--card);padding:.15em .4em;border-radius:4px;font-size:.85em;font-family:'SF Mono',Monaco,monospace}
#preview pre{background:var(--card);padding:1rem;border-radius:8px;overflow-x:auto;margin:.75em 0}
#preview pre code{background:none;padding:0}
#preview ul,#preview ol{padding-left:1.5em;margin:.5em 0}
#preview blockquote{border-left:3px solid var(--accent);padding-left:1em;color:var(--muted);margin:.5em 0}
#preview a{color:var(--accent)}
#preview img{max-width:100%;border-radius:8px}

.panel{position:fixed;top:0;right:-420px;width:420px;max-width:92vw;height:100vh;background:var(--surface);border-left:1px solid var(--border);transition:right .25s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;z-index:100}
.panel.open{right:0}
.panel-head{display:flex;align-items:center;padding:.9rem 1.25rem;gap:.6rem;border-bottom:1px solid var(--border)}
.panel-head h2{font-size:.88rem;font-weight:600;flex:1}
.search-row{display:flex;gap:.5rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)}
.search-box{flex:1;padding:.55rem .85rem;background:var(--bg);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-size:.8rem;outline:none;transition:border-color .15s}
.search-box:focus{border-color:var(--accent)}
.list{flex:1;overflow-y:auto;padding:.75rem 1rem}
.item{position:relative;padding:.75rem 1rem;margin-bottom:.5rem;background:var(--card);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s}
.item:hover{border-color:var(--border2);background:var(--card-hover)}
.item.pinned{border-color:color-mix(in srgb,var(--pin) 30%,transparent)}
.item.preserved{border-color:color-mix(in srgb,var(--pv) 30%,transparent)}
.item-content{font-size:.8rem;color:var(--text);line-height:1.4;max-height:3.6em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:.4rem;word-break:break-all;opacity:.85}
.item-meta{display:flex;align-items:center;gap:.5rem;font-size:.68rem;color:var(--muted)}
.item-actions{position:absolute;top:.4rem;right:.4rem;display:flex;gap:.35rem;opacity:0;transition:opacity .15s}
.item:hover .item-actions{opacity:1}
@media(pointer:coarse){.item-actions{opacity:1}}
.act{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:none;background:var(--border);color:var(--muted);cursor:pointer;font-size:.9rem;transition:all .15s;-webkit-tap-highlight-color:transparent}
.act:hover{background:var(--border2);color:var(--text)}
.act:active{transform:scale(.9)}
.act.active{color:var(--pin);background:var(--pin-bg)}
.act.pv.active{color:var(--pv);background:var(--pv-bg)}
.badge{display:inline-block;padding:.1rem .35rem;border-radius:3px;font-size:.62rem;font-weight:500}
.badge-pin{background:var(--pin-bg);color:var(--pin)}
.badge-pv{background:var(--pv-bg);color:var(--pv)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;opacity:0;pointer-events:none;transition:opacity .25s}
.overlay.open{opacity:1;pointer-events:auto}
</style>
<script>if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'</script>
</head><body>
<header>
<div class="dot" id="dot"></div>
<span class="room-name">${room}</span>
<span class="spacer"></span>
<div class="mode-group">
<button class="mbtn active" id="btn-md" onclick="setFormat('md')">MD</button>
<button class="mbtn" id="btn-txt" onclick="setFormat('txt')">TXT</button>
<button class="mbtn" id="btn-preview" onclick="setFormat('preview')">预览</button>
</div>
<button class="btn" onclick="newSession()">新建</button>
<button class="btn" onclick="togglePanel()">历史</button>
<button class="btn" id="theme-btn" onclick="toggleTheme()">☀</button>
</header>
<div class="main">
<textarea id="editor" placeholder="输入内容，自动同步到其他设备..." autofocus></textarea>
<div id="preview"></div>
</div>
<div class="overlay" id="overlay" onclick="togglePanel()"></div>
<div class="panel" id="panel">
<div class="panel-head"><h2>历史记录</h2><button class="btn" onclick="loadHistory(document.getElementById('search').value)">刷新</button><button class="btn" onclick="togglePanel()">关闭</button></div>
<div class="search-row"><input class="search-box" id="search" placeholder="搜索..."></div>
<div class="list" id="list"></div>
</div>
<script>
const room='${room}',editor=document.getElementById('editor'),dot=document.getElementById('dot'),preview=document.getElementById('preview');
let ws,timer,remote=false,format=localStorage.getItem('format')||'md';

// Theme
function toggleTheme(){
  const t=document.documentElement.dataset.theme==='light'?'':'light';
  document.documentElement.dataset.theme=t;
  localStorage.setItem('theme',t||'dark');
  document.getElementById('theme-btn').textContent=t==='light'?'☾':'☀';
}
document.getElementById('theme-btn').textContent=localStorage.getItem('theme')==='light'?'☾':'☀';

// Format
function setFormat(f){
  format=f;localStorage.setItem('format',f);
  document.querySelectorAll('.mode-group .mbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-'+f).classList.add('active');
  if(f==='preview'){
    editor.style.display='none';preview.style.display='block';
    preview.innerHTML=marked.parse(editor.value||'');
  } else {
    editor.style.display='block';preview.style.display='none';
    editor.focus();
  }
}
setFormat(format);

// WebSocket
function connect(){
  const p=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(p+'//'+location.host+'/api/ws/'+room);
  ws.onopen=()=>dot.classList.add('on');
  ws.onclose=()=>{dot.classList.remove('on');setTimeout(connect,2000)};
  ws.onmessage=e=>{
    remote=true;
    const s=editor.selectionStart;
    editor.value=e.data;
    editor.selectionStart=editor.selectionEnd=Math.min(s,e.data.length);
    if(format==='preview')preview.innerHTML=marked.parse(e.data||'');
    remote=false;
  };
}

editor.addEventListener('input',()=>{
  if(remote)return;
  clearTimeout(timer);
  timer=setTimeout(()=>{if(ws&&ws.readyState===1)ws.send(editor.value)},300);
});

// New session
function newSession(){
  if(editor.value.trim()&&ws&&ws.readyState===1){ws.send(editor.value)}
  editor.value='';
  if(format==='preview'){preview.innerHTML=''}
  editor.focus();
}

// History panel
function togglePanel(){
  document.getElementById('panel').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
  if(document.getElementById('panel').classList.contains('open'))loadHistory();
}

async function loadHistory(q=''){
  const r=await fetch('/api/history/'+room+(q?'?q='+encodeURIComponent(q):''));
  const items=await r.json();
  document.getElementById('list').innerHTML=items.length?items.map(i=>{
    const badges=[];
    if(i.pinned)badges.push('<span class="badge badge-pin">置顶</span>');
    if(i.preserved)badges.push('<span class="badge badge-pv">保留</span>');
    return '<div class="item'+(i.pinned?' pinned':'')+(i.preserved?' preserved':'')+'" data-id="'+i.id+'">'+
      '<div class="item-actions">'+
        '<button class="act'+(i.pinned?' active':'')+'" onclick="event.stopPropagation();pin('+i.id+')" title="置顶">📌</button>'+
        '<button class="act pv'+(i.preserved?' active':'')+'" onclick="event.stopPropagation();preserve('+i.id+')" title="保留">⭐</button>'+
        '<button class="act" onclick="event.stopPropagation();del('+i.id+')" title="删除">🗑</button>'+
      '</div>'+
      '<div class="item-content">'+esc(i.content)+'</div>'+
      '<div class="item-meta"><span>'+timeAgo(i.updated_at)+'</span>'+badges.join('')+'</div>'+
    '</div>';
  }).join(''):'<div style="text-align:center;color:var(--muted);padding:2rem;font-size:.82rem">暂无历史记录</div>';
  document.querySelectorAll('.item').forEach(el=>el.addEventListener('click',()=>restore(el)));
}

function restore(el){
  editor.value=el.querySelector('.item-content').textContent;
  if(format==='preview')preview.innerHTML=marked.parse(editor.value||'');
  if(ws&&ws.readyState===1)ws.send(editor.value);
  togglePanel();
}

async function del(id){await fetch('/api/history/'+room+'/'+id,{method:'DELETE'});loadHistory(document.getElementById('search').value)}
async function pin(id){await fetch('/api/history/'+room+'/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pin'})});loadHistory(document.getElementById('search').value)}
async function preserve(id){await fetch('/api/history/'+room+'/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preserve'})});loadHistory(document.getElementById('search').value)}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function timeAgo(t){const d=Date.now()-new Date(t+'Z').getTime(),m=Math.floor(d/60000);if(m<1)return'刚刚';if(m<60)return m+'分钟前';const h=Math.floor(m/60);if(h<24)return h+'小时前';return Math.floor(h/24)+'天前'}

let st;document.getElementById('search').addEventListener('input',e=>{clearTimeout(st);st=setTimeout(()=>loadHistory(e.target.value),300)});
connect();
</script></body></html>`;
}
