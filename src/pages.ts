export function loginPage(error?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0c0c0c;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#161616;padding:2.5rem;border-radius:12px;width:100%;max-width:340px;border:1px solid #262626}
h1{font-size:1.4rem;margin-bottom:.4rem;color:#fff;font-weight:700;letter-spacing:-.02em}
.sub{font-size:.8rem;color:#666;margin-bottom:2rem}
input{width:100%;padding:.75rem 1rem;margin-bottom:.75rem;border:1px solid #333;border-radius:8px;background:#0c0c0c;color:#e8e8e8;font-size:.9rem;transition:border-color .15s}
input:focus{outline:none;border-color:#3b82f6}
button{width:100%;padding:.75rem;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;font-weight:600;transition:background .15s}
button:hover{background:#2563eb}
.error{color:#ef4444;font-size:.8rem;margin-bottom:.75rem;padding:.5rem .75rem;background:#1c1017;border-radius:6px;border:1px solid #3b1520}
</style></head><body>
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
body{background:#0c0c0c;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#161616;padding:2.5rem;border-radius:12px;width:100%;max-width:340px;border:1px solid #262626}
h1{font-size:1.4rem;margin-bottom:.4rem;color:#fff;font-weight:700;letter-spacing:-.02em}
.sub{font-size:.8rem;color:#666;margin-bottom:2rem}
input{width:100%;padding:.75rem 1rem;margin-bottom:.75rem;border:1px solid #333;border-radius:8px;background:#0c0c0c;color:#e8e8e8;font-size:.9rem;transition:border-color .15s}
input:focus{outline:none;border-color:#3b82f6}
button{width:100%;padding:.75rem;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;font-weight:600;transition:background .15s}
button:hover{background:#2563eb}
.error{color:#ef4444;font-size:.8rem;margin-bottom:.75rem;padding:.5rem .75rem;background:#1c1017;border-radius:6px;border:1px solid #3b1520}
</style></head><body>
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0c0c0c;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;padding:.75rem 1.25rem;background:#161616;border-bottom:1px solid #222;gap:.75rem}
.dot{width:8px;height:8px;border-radius:50%;background:#ef4444;transition:background .3s}
.dot.on{background:#22c55e}
.room-name{font-size:.85rem;font-weight:600;color:#999}
.spacer{flex:1}
.btn{background:none;border:1px solid #333;color:#999;padding:.4rem .8rem;border-radius:6px;cursor:pointer;font-size:.78rem;transition:all .15s}
.btn:hover{border-color:#3b82f6;color:#3b82f6}
#editor{flex:1;padding:1.25rem;background:#0c0c0c;border:none;color:#e8e8e8;font-family:'SF Mono',Monaco,'Fira Code',monospace;font-size:.9rem;line-height:1.6;resize:none;outline:none}
#editor::placeholder{color:#444}

.panel{position:fixed;top:0;right:-400px;width:400px;max-width:90vw;height:100vh;background:#161616;border-left:1px solid #262626;transition:right .25s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;z-index:100}
.panel.open{right:0}
.panel-head{display:flex;align-items:center;padding:1rem 1.25rem;gap:.75rem;border-bottom:1px solid #262626}
.panel-head h2{font-size:.9rem;font-weight:600;flex:1}
.panel-head .btn{padding:.3rem .6rem}
.search-box{margin:.75rem 1.25rem;padding:.6rem .9rem;background:#0c0c0c;border:1px solid #333;border-radius:8px;color:#e8e8e8;font-size:.82rem;outline:none;transition:border-color .15s}
.search-box:focus{border-color:#3b82f6}
.list{flex:1;overflow-y:auto;padding:.5rem 1rem}
.item{position:relative;padding:.75rem 1rem;margin-bottom:.5rem;background:#1c1c1c;border:1px solid #262626;border-radius:8px;cursor:pointer;transition:all .15s}
.item:hover{border-color:#333;background:#222}
.item.pinned{border-color:#f59e0b33;background:#1a1708}
.item.preserved{border-color:#22c55e33}
.item-content{font-size:.82rem;color:#ccc;line-height:1.4;max-height:3.6em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:.4rem;word-break:break-all}
.item-meta{display:flex;align-items:center;gap:.5rem;font-size:.7rem;color:#555}
.item-actions{position:absolute;top:.5rem;right:.5rem;display:flex;gap:.25rem;opacity:0;transition:opacity .15s}
.item:hover .item-actions{opacity:1}
.act{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;border:none;background:#333;color:#999;cursor:pointer;font-size:.7rem;transition:all .15s}
.act:hover{background:#444;color:#fff}
.act.active{color:#f59e0b;background:#2a2008}
.act.pv.active{color:#22c55e;background:#0a1f0a}
.badge{display:inline-block;padding:.1rem .4rem;border-radius:3px;font-size:.65rem;font-weight:500}
.badge-pin{background:#2a2008;color:#f59e0b}
.badge-pv{background:#0a1f0a;color:#22c55e}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;opacity:0;pointer-events:none;transition:opacity .25s}
.overlay.open{opacity:1;pointer-events:auto}
</style></head><body>
<header>
<div class="dot" id="dot"></div>
<span class="room-name">${room}</span>
<span class="spacer"></span>
<button class="btn" onclick="togglePanel()">历史</button>
</header>
<textarea id="editor" placeholder="输入内容，自动同步..." autofocus></textarea>
<div class="overlay" id="overlay" onclick="togglePanel()"></div>
<div class="panel" id="panel">
<div class="panel-head"><h2>历史记录</h2><button class="btn" onclick="togglePanel()">关闭</button></div>
<input class="search-box" id="search" placeholder="搜索...">
<div class="list" id="list"></div>
</div>
<script>
const room='${room}',editor=document.getElementById('editor'),dot=document.getElementById('dot');
let ws,timer,remote=false;

function connect(){
  const p=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(p+'//'+location.host+'/api/ws/'+room);
  ws.onopen=()=>dot.classList.add('on');
  ws.onclose=()=>{dot.classList.remove('on');setTimeout(connect,2000)};
  ws.onmessage=e=>{remote=true;const s=editor.selectionStart;editor.value=e.data;editor.selectionStart=editor.selectionEnd=Math.min(s,e.data.length);remote=false};
}

editor.addEventListener('input',()=>{
  if(remote)return;
  clearTimeout(timer);
  timer=setTimeout(()=>{if(ws&&ws.readyState===1)ws.send(editor.value)},300);
});

function togglePanel(){
  document.getElementById('panel').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
  if(document.getElementById('panel').classList.contains('open'))loadHistory();
}

async function loadHistory(q=''){
  const r=await fetch('/api/history/'+room+(q?'?q='+encodeURIComponent(q):''));
  const items=await r.json();
  document.getElementById('list').innerHTML=items.map(i=>{
    const badges=[];
    if(i.pinned)badges.push('<span class="badge badge-pin">置顶</span>');
    if(i.preserved)badges.push('<span class="badge badge-pv">保留</span>');
    return '<div class="item'+(i.pinned?' pinned':'')+(i.preserved?' preserved':'')+'" data-id="'+i.id+'">'+
      '<div class="item-actions">'+
        '<button class="act'+(i.pinned?' active':'')+'" onclick="event.stopPropagation();pin('+i.id+')" title="置顶">&#9650;</button>'+
        '<button class="act pv'+(i.preserved?' active':'')+'" onclick="event.stopPropagation();preserve('+i.id+')" title="保留">&#9733;</button>'+
        '<button class="act" onclick="event.stopPropagation();del('+i.id+')" title="删除">&#10005;</button>'+
      '</div>'+
      '<div class="item-content">'+esc(i.content)+'</div>'+
      '<div class="item-meta"><span>'+timeAgo(i.updated_at)+'</span>'+badges.join('')+'</div>'+
    '</div>';
  }).join('');
  document.querySelectorAll('.item').forEach(el=>el.addEventListener('click',()=>restore(el)));
}

function restore(el){
  const item=el.querySelector('.item-content');
  editor.value=item.textContent;
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
