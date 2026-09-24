import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const $ = s => document.querySelector(s);
const moods = [
  ['happy','☀️','Vui vẻ','#ffe49b'],
  ['calm','🌿','Bình yên','#cdebd9'],
  ['grateful','💜','Biết ơn','#e2d5fa'],
  ['sad','🌧️','Buồn chút','#d1e5fa'],
  ['stress','🔥','Căng thẳng','#ffd4c4']
];
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const BUCKET = 'journal-media';
const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateFromKey = value => new Date(`${value}T12:00:00`);
const dateLabel = value => dateFromKey(value).toLocaleDateString('vi-VN',{weekday:'long',day:'numeric',month:'long'});
const today = new Date();

let selected = key(today);
let month = new Date(today.getFullYear(),today.getMonth(),1);
let entries = new Map();
let draft = null;
let dirty = false;
let busy = false;
let currentUser = null;
let objectUrls = [];
let realtimeChannel = null;
let realtimeTimer = null;
let mediaRenderToken = 0;

function toast(message){
  $('#toast').textContent=message;
  $('#toast').style.display='block';
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>$('#toast').style.display='none',4500);
}
function setSync(message, error=false){
  const el=$('#sync-status');
  if(!el) return;
  el.textContent=message;
  el.classList.toggle('sync-error',error);
}
function markDirty(){
  dirty=true;
  $('#save-status').textContent='Có thay đổi chưa lưu';
}
function setBusy(value){
  busy=value;
  $('#save').disabled=value;
  $('#delete-entry').disabled=value;
  $('#export').disabled=value;
}
function canLeave(){
  return !busy && (!dirty || confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi để tiếp tục?'));
}
function userLabel(){
  return currentUser?.user_metadata?.display_name || currentUser?.email || 'Tài khoản';
}
function safeName(name){
  return (name || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'file';
}
function cleanMediaItem(item){
  return {name:item.name||'file',type:item.type||'application/octet-stream',size:Number(item.size)||0,path:item.path};
}
function dbRowToEntry(row){
  return {
    date:row.date,
    title:row.title||'',
    note:row.note||'',
    mood:row.mood||'',
    color:row.color||'',
    media:Array.isArray(row.media)?row.media.map(cleanMediaItem):[],
    updatedAt:row.updated_at
  };
}
function entryToRow(entry){
  return {
    user_id:currentUser.id,
    date:entry.date,
    title:entry.title||'',
    note:entry.note||'',
    mood:entry.mood||'',
    color:entry.color||'',
    media:(entry.media||[]).map(cleanMediaItem),
    updated_at:new Date().toISOString()
  };
}

async function fetchEntries(){
  const {data,error}=await supabase
    .from('entries')
    .select('date,title,note,mood,color,media,updated_at')
    .order('date',{ascending:true});
  if(error) throw error;
  return data.map(dbRowToEntry);
}
async function reloadFromCloud({keepDraft=false}={}){
  setSync('☁ Đang đồng bộ…');
  const rows=await fetchEntries();
  entries=new Map(rows.map(e=>[e.date,e]));
  renderCalendar();
  if(!keepDraft) await loadDraft();
  setSync('☁ Đã đồng bộ');
}
function scheduleCloudRefresh(){
  clearTimeout(realtimeTimer);
  realtimeTimer=setTimeout(async()=>{
    try{
      if(dirty){
        setSync('☁ Có thay đổi mới');
        return;
      }
      await reloadFromCloud();
    }catch{
      setSync('☁ Lỗi đồng bộ',true);
    }
  },350);
}
function startRealtime(){
  stopRealtime();
  realtimeChannel=supabase
    .channel(`entries-${currentUser.id}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'entries',
      filter:`user_id=eq.${currentUser.id}`
    },scheduleCloudRefresh)
    .subscribe(status=>{
      if(status==='SUBSCRIBED') setSync('☁ Đã đồng bộ');
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') setSync('☁ Mất kết nối',true);
    });
}
function stopRealtime(){
  clearTimeout(realtimeTimer);
  if(realtimeChannel){
    supabase.removeChannel(realtimeChannel);
    realtimeChannel=null;
  }
}

function renderCalendar(){
  $('#month-label').textContent=`Tháng ${month.getMonth()+1}, ${month.getFullYear()}`;
  const grid=$('#calendar');
  grid.replaceChildren();
  const offset=(month.getDay()+6)%7;
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  for(let i=0;i<offset;i++){
    const blank=document.createElement('span');
    blank.className='blank';
    grid.append(blank);
  }
  let count=0;
  for(let n=1;n<=days;n++){
    const d=key(new Date(month.getFullYear(),month.getMonth(),n));
    const entry=entries.get(d);
    const mood=moods.find(m=>m[0]===entry?.mood);
    const button=document.createElement('button');
    if(entry) count++;
    button.className=`day${d===selected?' selected':''}${d===key(today)?' is-today':''}${entry?' has-entry':''}`;
    button.setAttribute('aria-label',`${dateLabel(d)}${mood?', '+mood[2]:''}${entry?', có nhật ký':''}`);
    button.setAttribute('aria-pressed',String(d===selected));
    if(entry?.color){
      button.style.background=entry.color;
      const rgb=entry.color.slice(1).match(/../g).map(h=>parseInt(h,16));
      button.style.color=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000<140?'#ffffff':'#332b4c';
    }
    const number=document.createElement('span');
    number.className='number';
    number.textContent=n;
    const emoji=document.createElement('span');
    emoji.className='emoji';
    emoji.textContent=mood?.[1]||(entry?'✎':'');
    button.append(number,emoji);
    button.onclick=async()=>{
      if(d!==selected&&canLeave()){
        selected=d;
        await loadDraft();
        renderCalendar();
      }
    };
    grid.append(button);
  }
  $('#month-summary').textContent=`${count} ngày đã được giữ lại ♡`;
}
function renderMoods(){
  $('#moods').replaceChildren();
  for(const m of moods){
    const b=document.createElement('button');
    b.className=`mood ${draft.mood===m[0]?'active':''}`;
    b.setAttribute('aria-pressed',String(draft.mood===m[0]));
    b.innerHTML=`<span>${m[1]}</span><small>${m[2]}</small>`;
    b.onclick=()=>{
      if(busy) return;
      draft.mood=m[0];
      draft.color=m[3];
      $('#custom-color').value=m[3];
      markDirty();
      renderMoods();
    };
    $('#moods').append(b);
  }
}
async function getSignedUrl(item){
  if(!item.path) return null;
  if(item.url && item.urlExpiresAt>Date.now()+60000) return item.url;
  const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(item.path,3600);
  if(error) throw error;
  item.url=data.signedUrl;
  item.urlExpiresAt=Date.now()+3500*1000;
  return item.url;
}
async function renderMedia(){
  const token=++mediaRenderToken;
  for(const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls=[];
  const list=$('#media-list');
  list.replaceChildren();
  $('#media-count').textContent=`${draft.media.length} tệp`;
  if(!draft.media.length){
    const empty=document.createElement('div');
    empty.className='empty-media';
    empty.textContent='Thêm một khoảnh khắc cho ngày này ♡';
    list.append(empty);
    return;
  }
  for(const [i,item] of draft.media.entries()){
    if(token!==mediaRenderToken) return;
    const wrap=document.createElement('div');
    wrap.className='media-item';
    const el=document.createElement((item.type||'').startsWith('video/')?'video':'img');
    try{
      if(item.blob){
        const url=URL.createObjectURL(item.blob);
        objectUrls.push(url);
        el.src=url;
      }else{
        el.src=await getSignedUrl(item);
      }
    }catch{
      el.alt='Không tải được tệp';
    }
    if(el.tagName==='VIDEO'){
      el.controls=true;
      el.playsInline=true;
      el.preload='metadata';
    }else{
      el.alt=item.name||'Ảnh nhật ký';
      el.loading='lazy';
    }
    const remove=document.createElement('button');
    remove.textContent='×';
    remove.setAttribute('aria-label',`Bỏ ${item.name||'tệp'}`);
    remove.onclick=()=>{
      if(busy) return;
      draft.media.splice(i,1);
      markDirty();
      renderMedia();
    };
    wrap.append(el,remove);
    list.append(wrap);
  }
}
async function loadDraft(){
  const saved=entries.get(selected);
  draft=saved
    ? {...saved,media:saved.media.map(m=>({...m}))}
    : {date:selected,title:'',note:'',mood:'',color:'',media:[]};
  dirty=false;
  $('#entry-date').textContent=dateLabel(selected);
  $('#entry-title').value=draft.title;
  $('#entry-note').value=draft.note;
  $('#custom-color').value=draft.color||'#ffe49b';
  $('#save-status').textContent=saved?'Kỷ niệm đã đồng bộ trên tài khoản ♡':'Chọn tâm trạng và viết vài dòng nhé.';
  renderMoods();
  await renderMedia();
}

$('#entry-title').oninput=e=>{draft.title=e.target.value;markDirty();};
$('#entry-note').oninput=e=>{draft.note=e.target.value;markDirty();};
$('#custom-color').oninput=e=>{draft.color=e.target.value;markDirty();};

async function addFiles(e){
  if(busy){e.target.value='';return;}
  for(const file of [...e.target.files]){
    if(!/^(image|video)\//.test(file.type)){
      toast('Chỉ hỗ trợ ảnh và video.');
      continue;
    }
    if(file.size>100*1024*1024){
      toast('Mỗi tệp tối đa 100 MB. Hãy chọn video ngắn hơn.');
      continue;
    }
    draft.media.push({name:file.name,type:file.type,size:file.size,blob:file});
    markDirty();
  }
  e.target.value='';
  await renderMedia();
}
for(const id of ['photo-input','video-input','library-input']) $('#'+id).onchange=addFiles;

async function uploadPendingMedia(media,date){
  const result=[];
  const created=[];
  try{
    for(const item of media){
      if(item.path){
        result.push(cleanMediaItem(item));
        continue;
      }
      if(!item.blob) throw new Error('missing-media-blob');
      const path=`${currentUser.id}/${date}/${crypto.randomUUID()}-${safeName(item.name)}`;
      const {error}=await supabase.storage.from(BUCKET).upload(path,item.blob,{
        cacheControl:'3600',
        contentType:item.type,
        upsert:false
      });
      if(error) throw error;
      created.push(path);
      result.push({name:item.name,type:item.type,size:item.size||item.blob.size,path});
    }
    return {media:result,created};
  }catch(error){
    if(created.length) await supabase.storage.from(BUCKET).remove(created).catch(()=>{});
    throw error;
  }
}
async function removePaths(paths){
  if(!paths.length) return;
  const {error}=await supabase.storage.from(BUCKET).remove(paths);
  if(error) throw error;
}

$('#save').onclick=async()=>{
  if(busy) return;
  if(!draft.title.trim()&&!draft.note.trim()&&!draft.mood&&!draft.color&&!draft.media.length){
    toast('Thêm tâm trạng, màu, ghi chú hoặc một khoảnh khắc nhé.');
    return;
  }
  setBusy(true);
  $('#entry-title').disabled=true;
  $('#entry-note').disabled=true;
  setSync('☁ Đang lưu…');
  const old=entries.get(selected);
  const oldPaths=new Set((old?.media||[]).map(m=>m.path).filter(Boolean));
  let created=[];
  try{
    const uploaded=await uploadPendingMedia(draft.media,selected);
    created=uploaded.created;
    const item={...draft,media:uploaded.media,updatedAt:new Date().toISOString()};
    const {error}=await supabase.from('entries').upsert(entryToRow(item),{onConflict:'user_id,date'});
    if(error) throw error;
    const keep=new Set(item.media.map(m=>m.path));
    const removed=[...oldPaths].filter(p=>!keep.has(p));
    if(removed.length){
      try{await removePaths(removed);}catch{toast('Nhật ký đã lưu; một số tệp cũ chưa dọn được.');}
    }
    entries.set(selected,item);
    draft={...item,media:item.media.map(m=>({...m}))};
    dirty=false;
    renderCalendar();
    await renderMedia();
    $('#save-status').textContent='Đã lưu và đồng bộ ♡';
    setSync('☁ Đã đồng bộ');
    toast('Đã cất giữ một ngày xinh ♡');
  }catch(error){
    if(created.length) await supabase.storage.from(BUCKET).remove(created).catch(()=>{});
    console.error(error);
    setSync('☁ Lỗi đồng bộ',true);
    toast('Không lưu được lên đám mây. Kiểm tra mạng rồi thử lại.');
  }finally{
    setBusy(false);
    $('#entry-title').disabled=false;
    $('#entry-note').disabled=false;
  }
};

$('#delete-entry').onclick=async()=>{
  if(busy||!confirm('Xóa nhật ký, màu và tất cả ảnh/video của ngày này trên mọi thiết bị?')) return;
  setBusy(true);
  setSync('☁ Đang xóa…');
  const saved=entries.get(selected);
  try{
    const {error}=await supabase.from('entries').delete().eq('date',selected);
    if(error) throw error;
    const paths=(saved?.media||[]).map(m=>m.path).filter(Boolean);
    if(paths.length){
      try{await removePaths(paths);}catch{toast('Đã xóa nhật ký; một số tệp lưu trữ chưa dọn được.');}
    }
    entries.delete(selected);
    await loadDraft();
    renderCalendar();
    setSync('☁ Đã đồng bộ');
    toast('Đã xóa nhật ký của ngày này.');
  }catch(error){
    console.error(error);
    setSync('☁ Lỗi đồng bộ',true);
    toast('Không thể xóa. Kiểm tra mạng rồi thử lại.');
  }finally{
    setBusy(false);
  }
};

for(const [id,delta] of [['prev',-1],['next',1]]){
  $('#'+id).onclick=()=>{
    month=new Date(month.getFullYear(),month.getMonth()+delta,1);
    renderCalendar();
  };
}
$('#today').onclick=async()=>{
  if(!canLeave()) return;
  selected=key(today);
  month=new Date(today.getFullYear(),today.getMonth(),1);
  await loadDraft();
  renderCalendar();
};
$('#today-label').textContent=`Hôm nay • ${today.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric',year:'numeric'})}`;
$('#backup-open').onclick=()=>$('#backup-dialog').showModal();

const toDataURL=blob=>new Promise((resolve,reject)=>{
  const r=new FileReader();
  r.onload=()=>resolve(r.result);
  r.onerror=reject;
  r.readAsDataURL(blob);
});
async function mediaBlob(item){
  if(item.blob) return item.blob;
  const {data,error}=await supabase.storage.from(BUCKET).download(item.path);
  if(error) throw error;
  return data;
}
$('#export').onclick=async()=>{
  if(busy) return;
  if(dirty){
    toast('Hãy lưu nhật ký đang viết trước khi sao lưu.');
    return;
  }
  setBusy(true);
  toast('Đang chuẩn bị bản sao lưu…');
  try{
    const data=[];
    for(const entry of entries.values()){
      const media=[];
      for(const m of entry.media){
        const blob=await mediaBlob(m);
        media.push({name:m.name,type:m.type,data:await toDataURL(blob)});
      }
      data.push({...entry,media});
    }
    const blob=new Blob([JSON.stringify({app:'ngay-xinh',version:1,entries:data})],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`ngay-xinh-${key(new Date())}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('Đã tạo bản sao lưu.');
  }catch(error){
    console.error(error);
    toast('Không tạo được bản sao lưu. Kiểm tra mạng rồi thử lại.');
  }finally{
    setBusy(false);
  }
};
function validEntry(e){
  return e &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    !isNaN(dateFromKey(e.date)) &&
    key(dateFromKey(e.date))===e.date &&
    typeof e.title==='string' &&
    typeof e.note==='string' &&
    typeof e.mood==='string' &&
    (!e.mood||moods.some(m=>m[0]===e.mood)) &&
    typeof e.color==='string' &&
    (!e.color||/^#[0-9a-f]{6}$/i.test(e.color)) &&
    Array.isArray(e.media);
}
$('#import').onchange=async e=>{
  const file=e.target.files[0];
  e.target.value='';
  if(!file||!canLeave()) return;
  setBusy(true);
  setSync('☁ Đang khôi phục…');
  const created=[];
  try{
    const data=JSON.parse(await file.text());
    if(data.app!=='ngay-xinh'||data.version!==1||!Array.isArray(data.entries)||!data.entries.every(validEntry)) throw new Error('format');
    const duplicates=data.entries.filter(x=>entries.has(x.date)).length;
    if(!confirm(`Khôi phục ${data.entries.length} ngày lên tài khoản này? ${duplicates} ngày trùng sẽ được thay thế.`)) return;
    for(const entry of data.entries){
      const pending=[];
      for(const m of entry.media){
        if(typeof m.name!=='string'||typeof m.type!=='string'||!/^(image|video)\/[a-z0-9.+-]+$/i.test(m.type)||typeof m.data!=='string'||!m.data.startsWith(`data:${m.type};base64,`)) throw new Error('format');
        const raw=atob(m.data.split(',')[1]);
        const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
        const blob=new Blob([bytes],{type:m.type});
        pending.push({name:m.name,type:m.type,size:blob.size,blob});
      }
      const old=entries.get(entry.date);
      const oldPaths=(old?.media||[]).map(m=>m.path).filter(Boolean);
      const uploaded=await uploadPendingMedia(pending,entry.date);
      created.push(...uploaded.created);
      const item={date:entry.date,title:entry.title,note:entry.note,mood:entry.mood,color:entry.color,media:uploaded.media,updatedAt:new Date().toISOString()};
      const {error}=await supabase.from('entries').upsert(entryToRow(item),{onConflict:'user_id,date'});
      if(error) throw error;
      if(oldPaths.length) await supabase.storage.from(BUCKET).remove(oldPaths).catch(()=>{});
      entries.set(item.date,item);
    }
    await loadDraft();
    renderCalendar();
    $('#backup-dialog').close();
    setSync('☁ Đã đồng bộ');
    toast('Đã khôi phục và đồng bộ kỷ niệm.');
  }catch(error){
    console.error(error);
    if(created.length) await supabase.storage.from(BUCKET).remove(created).catch(()=>{});
    setSync('☁ Lỗi đồng bộ',true);
    toast('Không khôi phục được: tệp không hợp lệ hoặc kết nối có lỗi.');
  }finally{
    setBusy(false);
  }
};

function showAuthView(view){
  const login=view==='login';
  $('#login-form').hidden=!login;
  $('#register-form').hidden=login;
  $('#show-login').classList.toggle('active',login);
  $('#show-register').classList.toggle('active',!login);
  $('#show-login').setAttribute('aria-selected',String(login));
  $('#show-register').setAttribute('aria-selected',String(!login));
  $('#login-status').textContent='';
  $('#register-status').textContent='';
  setTimeout(()=>$(login?'#login-username':'#register-name').focus(),0);
}
function setAuthFormBusy(value){
  for(const el of document.querySelectorAll('.auth-form input,.auth-form button,.auth-tab')) el.disabled=value;
}
function showAuth(){
  $('#auth-screen').hidden=false;
  $('#app-main').hidden=true;
  $('#account-status').hidden=true;
  $('#sync-status').hidden=true;
  $('#backup-open').hidden=true;
  $('#logout').hidden=true;
  $('#account-list').hidden=true;
  showAuthView('login');
}
function showApp(){
  $('#auth-screen').hidden=true;
  $('#app-main').hidden=false;
  $('#account-status').hidden=false;
  $('#sync-status').hidden=false;
  $('#backup-open').hidden=false;
  $('#logout').hidden=false;
  $('#account-status').textContent=`👤 ${userLabel()}`;
}
async function startApp(user){
  currentUser=user;
  showApp();
  setBusy(false);
  selected=key(today);
  month=new Date(today.getFullYear(),today.getMonth(),1);
  try{
    await reloadFromCloud();
    startRealtime();
  }catch(error){
    console.error(error);
    $('#save-status').textContent='Không tải được dữ liệu từ đám mây.';
    setSync('☁ Lỗi đồng bộ',true);
  }
}
async function stopApp(){
  stopRealtime();
  for(const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls=[];
  entries.clear();
  draft=null;
  dirty=false;
  currentUser=null;
  showAuth();
}

$('#show-login').onclick=()=>showAuthView('login');
$('#show-register').onclick=()=>showAuthView('register');

$('#login-form').onsubmit=async e=>{
  e.preventDefault();
  const email=$('#login-username').value.trim();
  const password=$('#login-password').value;
  const status=$('#login-status');
  status.textContent='';
  setAuthFormBusy(true);
  try{
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    $('#login-password').value='';
  }catch(error){
    console.error(error);
    status.textContent='Email hoặc mật khẩu không đúng, hoặc tài khoản chưa xác nhận email.';
  }finally{
    setAuthFormBusy(false);
  }
};
$('#register-form').onsubmit=async e=>{
  e.preventDefault();
  const displayName=$('#register-name').value.trim();
  const email=$('#register-username').value.trim();
  const password=$('#register-password').value;
  const confirmPassword=$('#register-confirm').value;
  const status=$('#register-status');
  status.textContent='';
  if(password.length<6){
    status.textContent='Mật khẩu cần ít nhất 6 ký tự.';
    return;
  }
  if(password!==confirmPassword){
    status.textContent='Hai mật khẩu chưa trùng nhau.';
    return;
  }
  setAuthFormBusy(true);
  try{
    const redirectTo=location.origin+location.pathname;
    const {data,error}=await supabase.auth.signUp({
      email,
      password,
      options:{data:{display_name:displayName||email.split('@')[0]},emailRedirectTo:redirectTo}
    });
    if(error) throw error;
    $('#register-password').value='';
    $('#register-confirm').value='';
    if(data.session){
      status.textContent='Tạo tài khoản thành công.';
    }else{
      status.textContent='Đã tạo tài khoản. Hãy mở email để xác nhận rồi đăng nhập.';
    }
  }catch(error){
    console.error(error);
    status.textContent='Không tạo được tài khoản. Kiểm tra email hoặc thử lại sau.';
  }finally{
    setAuthFormBusy(false);
  }
};
$('#forgot-password').onclick=async()=>{
  const email=$('#login-username').value.trim();
  if(!email){
    $('#login-status').textContent='Nhập email trước rồi chọn Quên mật khẩu.';
    $('#login-username').focus();
    return;
  }
  setAuthFormBusy(true);
  try{
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(error) throw error;
    $('#login-status').textContent='Đã gửi email đặt lại mật khẩu.';
  }catch(error){
    console.error(error);
    $('#login-status').textContent='Không gửi được email đặt lại mật khẩu.';
  }finally{
    setAuthFormBusy(false);
  }
};
$('#logout').onclick=async()=>{
  if(!canLeave()) return;
  const {error}=await supabase.auth.signOut();
  if(error) toast('Không đăng xuất được. Vui lòng thử lại.');
};

supabase.auth.onAuthStateChange((event,session)=>{
  setTimeout(async()=>{
    if(event==='PASSWORD_RECOVERY'){
      const password=prompt('Nhập mật khẩu mới (ít nhất 6 ký tự):');
      if(password){
        const {error}=await supabase.auth.updateUser({password});
        toast(error?'Không đổi được mật khẩu.':'Đã đổi mật khẩu.');
      }
      return;
    }
    if(session?.user){
      if(currentUser?.id!==session.user.id) await startApp(session.user);
    }else if(event==='SIGNED_OUT'){
      await stopApp();
    }
  },0);
});

addEventListener('beforeunload',e=>{
  if(currentUser&&(dirty||busy)){
    e.preventDefault();
    e.returnValue='';
  }
});
for(const label of document.querySelectorAll('.capture')){
  label.tabIndex=0;
  label.setAttribute('role','button');
  label.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      label.querySelector('input').click();
    }
  });
}

const {data:{session},error:sessionError}=await supabase.auth.getSession();
if(sessionError){
  console.error(sessionError);
  showAuth();
}else if(session?.user){
  await startApp(session.user);
}else{
  showAuth();
}
