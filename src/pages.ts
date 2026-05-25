export function loginPage(error?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past - Login</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#16213e;padding:2rem;border-radius:8px;width:100%;max-width:320px}
h1{font-size:1.2rem;margin-bottom:1.5rem;color:#a0c4ff}
input{width:100%;padding:.6rem;margin-bottom:.8rem;border:1px solid #333;border-radius:4px;background:#0f3460;color:#e0e0e0;font-size:.9rem}
input:focus{outline:none;border-color:#a0c4ff}
button{width:100%;padding:.6rem;background:#a0c4ff;color:#1a1a2e;border:none;border-radius:4px;font-size:.9rem;cursor:pointer;font-weight:600}
button:hover{background:#7fb3ff}
.error{color:#ff6b6b;font-size:.8rem;margin-bottom:.8rem}
</style></head><body>
<div class="card"><h1>cf2past</h1>
${error ? `<div class="error">${error}</div>` : ''}
<form method="POST" action="/login">
<input name="username" placeholder="用户名" autocomplete="username" required autofocus>
<input name="password" type="password" placeholder="密码" autocomplete="current-password" required>
<button type="submit">登录</button>
</form></div></body></html>`;
}

export function setupPage(error?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past - Setup</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#16213e;padding:2rem;border-radius:8px;width:100%;max-width:320px}
h1{font-size:1.2rem;margin-bottom:.5rem;color:#a0c4ff}
p{font-size:.8rem;color:#888;margin-bottom:1.5rem}
input{width:100%;padding:.6rem;margin-bottom:.8rem;border:1px solid #333;border-radius:4px;background:#0f3460;color:#e0e0e0;font-size:.9rem}
input:focus{outline:none;border-color:#a0c4ff}
button{width:100%;padding:.6rem;background:#a0c4ff;color:#1a1a2e;border:none;border-radius:4px;font-size:.9rem;cursor:pointer;font-weight:600}
button:hover{background:#7fb3ff}
.error{color:#ff6b6b;font-size:.8rem;margin-bottom:.8rem}
</style></head><body>
<div class="card"><h1>cf2past</h1><p>首次使用，创建管理员账号</p>
${error ? `<div class="error">${error}</div>` : ''}
<form method="POST" action="/setup">
<input name="username" placeholder="用户名" autocomplete="username" required autofocus>
<input name="password" type="password" placeholder="密码（至少4位）" autocomplete="new-password" required minlength="4">
<button type="submit">创建账号</button>
</form></div></body></html>`;
}

export function mainPage(room: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf2past - ${room}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;height:100vh;display:flex;flex-direction:column}
header{display:flex;align-items:center;padding:.5rem 1rem;background:#16213e;gap:.8rem;font-size:.85rem}
.room{color:#a0c4ff;font-weight:600}
.status{width:8px;height:8px;border-radius:50%;background:#ff6b6b}
.status.connected{background:#4caf50}
.spacer{flex:1}
button{background:none;border:1px solid #444;color:#aaa;padding:.3rem .6rem;border-radius:4px;cursor:pointer;font-size:.8rem}
button:hover{border-color:#a0c4ff;color:#a0c4ff}
#editor{flex:1;padding:1rem;background:#0f3460;border:none;color:#e0e0e0;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:.9rem;resize:none;outline:none}
#history-panel{position:fixed;top:0;right:-360px;width:360px;height:100vh;background:#16213e;transition:right .2s;display:flex;flex-direction:column;z-index:10;box-shadow:-2px 0 8px rgba(0,0,0,.3)}
#history-panel.open{right:0}
.panel-header{display:flex;align-items:center;padding:.8rem;gap:.5rem;border-bottom:1px solid #333}
.panel-header input{flex:1;padding:.4rem;background:#0f3460;border:1px solid #333;border-radius:4px;color:#e0e0e0;font-size:.8rem}
.panel-header input:focus{outline:none;border-color:#a0c4ff}
#history-list{flex:1;overflow-y:auto;padding:.5rem}
.history-item{padding:.5rem;margin-bottom:.3rem;background:#0f3460;border-radius:4px;cursor:pointer;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.history-item:hover{background:#1a4080}
.history-item .time{color:#666;font-size:.7rem}
</style></head><body>
<header>
<span class="status" id="status"></span>
<span class="room">${room}</span>
<span class="spacer"></span>
<button onclick="toggleHistory()">历史</button>
</header>
<textarea id="editor" placeholder="输入内容，自动同步到其他设备..." autofocus></textarea>
<div id="history-panel">
<div class="panel-header">
<input type="text" id="search" placeholder="搜索历史...">
<button onclick="toggleHistory()">关闭</button>
</div>
<div id="history-list"></div>
</div>
<script>
const room = '${room}';
const editor = document.getElementById('editor');
const status = document.getElementById('status');
let ws, debounceTimer, isRemoteUpdate = false;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host + '/api/ws/' + room);
  ws.onopen = () => status.classList.add('connected');
  ws.onclose = () => { status.classList.remove('connected'); setTimeout(connect, 2000); };
  ws.onmessage = (e) => {
    isRemoteUpdate = true;
    const pos = editor.selectionStart;
    editor.value = e.data;
    editor.selectionStart = editor.selectionEnd = Math.min(pos, e.data.length);
    isRemoteUpdate = false;
  };
}

editor.addEventListener('input', () => {
  if (isRemoteUpdate) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (ws && ws.readyState === 1) ws.send(editor.value);
  }, 300);
});

function toggleHistory() {
  const panel = document.getElementById('history-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) loadHistory();
}

async function loadHistory(q = '') {
  const res = await fetch('/api/history/' + room + (q ? '?q=' + encodeURIComponent(q) : ''));
  const items = await res.json();
  const list = document.getElementById('history-list');
  list.innerHTML = items.map(i =>
    '<div class="history-item" onclick="restore(this)" data-content="' + encodeURIComponent(i.content) + '">' +
    '<div class="time">' + new Date(i.created_at).toLocaleString() + '</div>' +
    i.content.slice(0, 80) + '</div>'
  ).join('');
}

function restore(el) {
  editor.value = decodeURIComponent(el.dataset.content);
  if (ws && ws.readyState === 1) ws.send(editor.value);
  toggleHistory();
}

document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(e.target._t);
  e.target._t = setTimeout(() => loadHistory(e.target.value), 300);
});

connect();
</script></body></html>`;
}
