// Account history is stored on the server; guest mode keeps the original offline workflow.
let account = null;
let accountBusy = false;
let historyPage = 1;
let historyRequest = 0;
let serverAvailable = false;
let connectionError = '';
let accountEpoch = 0;
let syncState = null;
let syncReady = Promise.resolve();
let historyDetailId = null;
const syncChannel = typeof BroadcastChannel!=='undefined' ? new BroadcastChannel('dpl302-practice-sync') : null;
const practiceSync = new PracticeSync.PracticeSync({
  store:new PracticeSync.IndexedQueue(globalThis.indexedDB),
  locks:globalThis.navigator?.locks,
  send:(payload,userId,signal)=>api('attempts','POST',payload,{accountId:userId,signal}),
  notify:userId=>syncChannel?.postMessage({userId}),
  onChange:state=>{
    if(!account||account.id!==state.userId)return;
    const wasPending=syncState?.pending;
    syncState=state;progress=state.progress;renderSyncStatus();
    if(currentView==='dashboard'&&!accountBusy)renderView();
    if(currentView==='history'&&wasPending&&!state.pending&&!historyDetailId)loadHistory();
  }
});
syncChannel?.addEventListener('message',event=>{
  if(event.data.userId===account?.id)practiceSync.refresh().then(()=>practiceSync.pump());
});
globalThis.addEventListener('online',()=>{practiceSync.retry().catch(()=>{});});
globalThis.addEventListener('focus',()=>{practiceSync.retry().catch(()=>{});});

function renderSyncStatus(){
  const root=$('#practiceSyncStatus');
  if(!root)return;
  root.hidden=!account;
  if(!account)return;
  if(!syncState){root.textContent='Đang tải dữ liệu chờ đồng bộ…';return;}
  if(practice.persisting){root.textContent='Đang lưu lượt trả lời…';return;}
  const count=syncState.pending;
  const text=syncState.status==='saved'?'Đã lưu':syncState.status==='syncing'?`Đang đồng bộ · ${count} lượt còn chờ`:
    syncState.status==='unavailable'?'Không thể lưu tạm trên thiết bị; lượt mới sẽ được lưu trực tiếp.':`Chưa đồng bộ · ${count} lượt còn chờ. ${syncState.error}`;
  root.innerHTML=`<span>${escapeHTML(text)}${currentView==='history'&&count?' Các lượt này chưa được xác nhận trong lịch sử.':''}</span>${syncState.authRequired?'<button class="mini-btn" id="syncLogin">Đăng nhập lại</button>':syncState.status==='error'?'<button class="mini-btn" id="syncRetry">Thử lại</button>':''}`;
  $('#syncLogin')?.addEventListener('click',()=>openAccount(true));
  $('#syncRetry')?.addEventListener('click',()=>{practiceSync.retry(true).catch(error=>toast(error.message));});
}

async function api(path, method = "GET", body, options={}){
  const controller=new AbortController();
  const abort=()=>controller.abort();
  options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)controller.abort();
  const timer=setTimeout(abort,15000);
  const userId=options.accountId??account?.id;
  try{
  const response = await fetch('/api/' + path, {
    method, credentials: 'same-origin',
    signal:controller.signal,
    headers: {...(method === 'GET' ? {} : {'Content-Type':'application/json'}),
      ...(userId!=null ? {'X-Account-ID':String(userId)} : {})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)})
  });
  if(!(response.headers.get('Content-Type')||'').includes('application/json')){
    const error=new Error(response.status===404
      ? 'Website chưa triển khai API tài khoản. Cần deploy backend Vercel mới.'
      : 'Máy chủ chưa trả về dữ liệu hợp lệ. Vui lòng thử lại.');
    error.status=response.status;throw error;
  }
  const data = await response.json();
  if(!response.ok){const error=new Error(data.error||'Không kết nối được máy chủ.');error.status=response.status;throw error;}
  return data;
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
function updateAccountButton(){
  $('#accountBtn').textContent = account ? account.username + ' · Tài khoản' : 'Đăng nhập';
}
function switchAccount(data){
  accountEpoch++;
  syncState=null;
  practiceSync.stop();
  account = data.user;
  progress = account ? data.progress : readJSON(STORAGE.progress, {known:[],wrong:[],attempts:0,correct:0});
  syncReady=practiceSync.start(account?.id,progress);
  // Personal question edits and imported banks must not spill into another account.
  const suffix = account ? '-user-' + account.id : '';
  questions = readJSON(STORAGE.custom + suffix, null) || clone(DEFAULT_QUESTIONS);
  overrides = readJSON(STORAGE.overrides + suffix, {});
  questions = questions.map(q=>({...q,...(overrides[q.id]||{})}));
  sections = [...new Set(questions.map(q=>q.section))];
  study = {pool:[],index:0,flipped:false,filter:'all'};
  practice = {pool:[],index:0,selected:null,checked:false,filter:'all',complete:false};
  test = {active:false,pool:[],index:0,answers:{},submitted:false};
  historyRequest++;
  historyPage = 1;
  updateAccountButton();
  accountBusy = false;
  navTo('dashboard');
}
function personalKey(key){ return key + (account ? '-user-' + account.id : ''); }
async function initializeAccount(){
  $('#accountBtn').onclick = openAccount;
  if(location.protocol === 'file:'){ navTo('dashboard'); return; }
  $('#appContent').innerHTML='<div class="empty-state">Đang tải tài khoản…</div>';
  accountBusy = true;
  try{
    const data = await api('me');
    serverAvailable = true;
    connectionError = '';
    switchAccount(data);
  }catch(error){
    serverAvailable = false;
    connectionError = error.message;
    accountBusy = false;
    navTo('dashboard');
    toast(connectionError);
  }finally{ accountBusy = false; }
}
document.addEventListener('click',event=>{
  if(accountBusy){event.preventDefault();event.stopImmediatePropagation();}
},true);
function openAccount(forceLogin=false){
  // DOM click events must not be interpreted as forceLogin=true.
  forceLogin=forceLogin===true;
  if(accountBusy){ toast('Đang lưu dữ liệu, vui lòng đợi.'); return; }
  if(!serverAvailable){
    const message=location.protocol==='file:'
      ? 'Chạy python server.py trong thư mục dự án, rồi mở http://localhost:8000 để dùng tài khoản.'
      : connectionError||'Chưa kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
    $('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Chưa kết nối được tài khoản</h3></div><div class="modal-body"><p role="alert">${escapeHTML(message)}</p><p class="small-muted">Bạn vẫn có thể học ở chế độ khách; lịch sử tài khoản chỉ được lưu khi kết nối thành công.</p></div><div class="modal-foot"><button class="secondary-btn" id="closeAccount">Đóng</button>${location.protocol!=='file:'?'<button class="primary-btn" id="retryConnection">Thử kết nối lại</button>':''}</div></div></div>`;
    $('#closeAccount').onclick=closeEditor;
    $('#retryConnection')?.addEventListener('click',()=>{closeEditor();initializeAccount();});
    return;
  }
  if(account&&!forceLogin){
    $('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${escapeHTML(account.username)}</h3></div><div class="modal-body"><p>Lịch sử và đáp án được lưu theo tài khoản này.</p><p class="small-muted">Tiến độ khách trên trình duyệt được giữ riêng.</p><p id="authError" role="alert"></p></div><div class="modal-foot"><button class="secondary-btn" id="closeAccount">Đóng</button><button class="primary-btn" id="logoutBtn">Đăng xuất</button></div></div></div>`;
    $('#closeAccount').onclick=closeEditor;
    $('#logoutBtn').onclick=async()=>{
      accountBusy=true; $('#logoutBtn').disabled=true;
      try{ await api('logout','POST',{}); closeEditor(); switchAccount({user:null}); }
      catch(error){ $('#authError').textContent=error.message; }
      finally{ accountBusy=false; if($('#logoutBtn')) $('#logoutBtn').disabled=false; }
    };
    return;
  }
  $('#modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal" id="authForm"><div class="modal-head"><h3>Đăng nhập / Đăng ký</h3></div><div class="modal-body"><div class="form-row"><label for="username">Tên tài khoản</label><input id="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9_.-]+" autocomplete="username" placeholder="Tên từ 3–40 ký tự"></div><div class="form-row"><label for="password">Mật khẩu</label><input id="password" type="password" required minlength="8" maxlength="128" autocomplete="current-password" placeholder="Tối thiểu 8 ký tự"></div><p class="small-muted">Tài khoản mới bắt đầu với lịch sử riêng. Tiến độ khách vẫn được giữ trên trình duyệt.</p><p id="authError" role="alert"></p></div><div class="modal-foot"><button type="button" class="ghost-btn" id="closeAccount">Đóng</button><button class="secondary-btn" type="submit" name="action" value="register">Đăng ký</button><button class="primary-btn" type="submit" name="action" value="login">Đăng nhập</button></div></form></div>`;
  $('#closeAccount').onclick=closeEditor;
  $('#authForm').onsubmit=async e=>{
    e.preventDefault();
    if(accountBusy)return;
    accountBusy=true;
    const form=e.currentTarget;
    const action=e.submitter?.value||'login';
    form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      const data=await api(action,'POST',{username:$('#username').value,password:$('#password').value});
      closeEditor();switchAccount(data);toast('Đã đăng nhập. Lịch sử được lưu trong database.');
    }catch(error){ $('#authError').textContent=error.message; }
    finally{accountBusy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  $('#username').focus();
}
async function saveAttempt(mode, pool, answers, eventId){
  const epoch=accountEpoch;
  const payload={
    mode,eventId,answers:pool.map(q=>({question:q,selected:answers[q.id]||null}))
  };
  const result=await api('attempts','POST',payload);
  if(epoch!==accountEpoch)throw new Error('Tài khoản đã thay đổi.');
  await syncReady;
  await practiceSync.confirm(result.progress,payload);
  return result.answers;
}
function newEventId(){
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
}
function renderHistory(){
  if(!account)return `<div class="page-title">Lịch sử làm bài</div><div class="empty-state"><strong>Đăng nhập để xem lịch sử của bạn</strong><p>Lưu từng câu luyện tập và bài kiểm tra cùng đáp án đã chọn, đáp án đúng và thời gian làm bài.</p><button class="primary-btn" id="historyLogin">Đăng nhập / Đăng ký</button></div>`;
  return `<div class="page-title">Lịch sử làm bài</div><p class="page-subtitle">${escapeHTML(account.username)} · Luyện tập và kiểm tra đã lưu trong database.</p><div id="historyContent" aria-live="polite">Đang tải…</div>`;
}
async function loadHistory(detailId){
  historyDetailId=detailId||null;
  if(!account){ $('#historyLogin')?.addEventListener('click',openAccount);return; }
  const request=++historyRequest;
  const root=$('#historyContent');
  const formatTime=t=>new Date(t*1000).toLocaleString('vi-VN');
  try{
    const data=await api(detailId?'history/'+detailId:'history?page='+historyPage);
    if(request!==historyRequest||currentView!=='history')return;
    if(detailId){
      const a=data.attempt;
      root.innerHTML=`<button class="secondary-btn" id="historyBack">← Danh sách</button><h2>${a.mode==='test'?'Kiểm tra':'Luyện tập'} · ${a.correct}/${a.total} câu đúng</h2><p class="small-muted">${formatTime(a.created_at)}</p><div class="result-list">${data.answers.map(r=>`<div class="result-item"><strong>Câu ${r.question_id} · ${escapeHTML(r.section)} · ${r.is_correct?'Đúng':'Sai'}</strong><p>${escapeHTML(r.question)}</p>${Object.entries(r.options).map(([k,v])=>`<p>${escapeHTML(k)}. ${escapeHTML(v)}</p>`).join('')}<p>Bạn chọn: <b>${r.selected_answer?escapeHTML(r.selected_answer)+'. '+escapeHTML(r.options[r.selected_answer]):'Chưa trả lời'}</b></p><p>Đáp án đúng: <b>${escapeHTML(r.correct_answer)}. ${escapeHTML(r.options[r.correct_answer])}</b></p></div>`).join('')}</div>`;
      $('#historyBack').onclick=()=>loadHistory();
    }else{
      root.innerHTML=data.items.length?`<div class="result-list">${data.items.map(a=>`<div class="result-item"><strong>${a.mode==='test'?'Kiểm tra':'Luyện tập'} · ${a.correct}/${a.total} câu đúng (${Math.round(a.correct/a.total*100)}%)</strong><p class="small-muted">${formatTime(a.created_at)}</p><button class="secondary-btn" data-attempt="${a.id}">Xem câu hỏi và đáp án</button></div>`).join('')}</div><div class="pagination"><button class="mini-btn" id="historyPrev" ${historyPage===1?'disabled':''}>← Trước</button><span>Trang ${historyPage} / ${Math.max(1,Math.ceil(data.total/20))}</span><button class="mini-btn" id="historyNext" ${historyPage*20>=data.total?'disabled':''}>Tiếp →</button></div>`:'<div class="empty-state"><strong>Chưa có lịch sử</strong>Hãy trả lời câu luyện tập hoặc nộp một bài kiểm tra.</div>';
      $$('[data-attempt]').forEach(b=>b.onclick=()=>loadHistory(b.dataset.attempt));
      $('#historyPrev')?.addEventListener('click',()=>{historyPage--;loadHistory();});
      $('#historyNext')?.addEventListener('click',()=>{historyPage++;loadHistory();});
    }
  }catch(error){
    if(request!==historyRequest||currentView!=='history')return;
    root.innerHTML=`<div class="empty-state"><p>${escapeHTML(error.message)}</p><button class="secondary-btn" id="historyRetry">Thử lại</button></div>`;
    $('#historyRetry').onclick=()=>loadHistory(detailId);
  }
}
