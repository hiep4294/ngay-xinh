const $ = s => document.querySelector(s);
const moods = [ ['happy','☀️','Vui vẻ','#ffe49b'],['calm','🌿','Bình yên','#cdebd9'],['grateful','💜','Biết ơn','#e2d5fa'],['sad','🌧️','Buồn chút','#d1e5fa'],['stress','🔥','Căng thẳng','#ffd4c4'] ];
const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = new Date();
let selected = key(today), month = new Date(today.getFullYear(),today.getMonth(),1), entries = new Map(), draft, dirty=false, busy=false, urls=[];
let currentUser = null, dbPromise = null;
const AUTH_KEY='ngay-xinh.accounts.v1', SESSION_KEY='ngay-xinh.session.v1', LEGACY_MIGRATION_KEY='ngay-xinh.legacy-migrated.v1';
const dateFromKey = value => new Date(`${value}T12:00:00`);
const dateLabel = value => dateFromKey(value).toLocaleDateString('vi-VN',{weekday:'long',day:'numeric',month:'long'});
const encoder = new TextEncoder();

function getAccounts(){try{const value=JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
function saveAccounts(accounts){localStorage.setItem(AUTH_KEY,JSON.stringify(accounts));}
function normalizeUsername(value){return value.trim().normalize('NFKC').toLocaleLowerCase('vi-VN');}
function validUsername(value){return value.length>=3&&value.length<=30&&!/\s/.test(value)&&/^[\p{L}\p{N}._-]+$/u.test(value);}
function randomId(){return crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');}
function bytesToBase64(bytes){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
function base64ToBytes(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
async function passwordDigest(password,saltValue){
 const salt=saltValue?base64ToBytes(saltValue):crypto.getRandomValues(new Uint8Array(16));
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},material,256);
 return {salt:bytesToBase64(salt),hash:bytesToBase64(new Uint8Array(bits))};
}
function userDbName(){if(!currentUser)throw new Error('not-authenticated');return `ngay-xinh-user-${currentUser.id}`;}
function getDb(){
 if(!currentUser)return Promise.reject(new Error('not-authenticated'));
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(userDbName(),1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('entries'))r.result.createObjectStore('entries',{keyPath:'date'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));});
 return dbPromise;
}
async function closeDb(){if(!dbPromise)return;try{const db=await dbPromise;db.close();}catch{}dbPromise=null;}
async function readAll(){const db=await getDb();return new Promise((resolve,reject)=>{const r=db.transaction('entries').objectStore('entries').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function writeEntries(items,remove){const db=await getDb();return new Promise((resolve,reject)=>{const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');if(remove)store.delete(remove);for(const item of items)store.put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function readLegacyEntries(){
 try{
  if(indexedDB.databases){const dbs=await indexedDB.databases();if(!dbs.some(x=>x.name==='ngay-xinh'))return [];}
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ngay-xinh');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  if(!db.objectStoreNames.contains('entries')){db.close();return [];}
  const items=await new Promise((resolve,reject)=>{const r=db.transaction('entries').objectStore('entries').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  db.close();return items;
 }catch{return [];}
}
async function maybeMigrateLegacy(){
 if(localStorage.getItem(LEGACY_MIGRATION_KEY))return 0;
 const items=await readLegacyEntries();
 if(items.length)await writeEntries(items);
 localStorage.setItem(LEGACY_MIGRATION_KEY,currentUser.id);
 return items.length;
}

let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',4500);}
function markDirty(){dirty=true;$('#save-status').textContent='Có thay đổi chưa lưu';}
function setBusy(value){busy=value;$('#save').disabled=value;$('#delete-entry').disabled=value;$('#export').disabled=value;}
function canLeave(){return !busy&&(!dirty||confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi để tiếp tục?'));}
function renderCalendar(){
 $('#month-label').textContent=`Tháng ${month.getMonth()+1}, ${month.getFullYear()}`;
 const grid=$('#calendar');grid.replaceChildren();const offset=(month.getDay()+6)%7,days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.className='blank';grid.append(blank);}
 let count=0;
 for(let n=1;n<=days;n++){const d=key(new Date(month.getFullYear(),month.getMonth(),n)),entry=entries.get(d),mood=moods.find(m=>m[0]===entry?.mood),button=document.createElement('button');if(entry)count++;
 button.className=`day${d===selected?' selected':''}${d===key(today)?' is-today':''}${entry?' has-entry':''}`;button.setAttribute('aria-label',`${dateLabel(d)}${mood?', '+mood[2]:''}${entry?', có nhật ký':''}`);button.setAttribute('aria-pressed',String(d===selected));if(entry?.color){button.style.background=entry.color;const rgb=entry.color.slice(1).match(/../g).map(h=>parseInt(h,16));button.style.color=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000<140?'#ffffff':'#332b4c';}
 const number=document.createElement('span');number.className='number';number.textContent=n;const emoji=document.createElement('span');emoji.className='emoji';emoji.textContent=mood?.[1]||(entry?'✎':'');button.append(number,emoji);button.onclick=()=>{if(d!==selected&&canLeave()){selected=d;loadDraft();renderCalendar();}};grid.append(button);}
 $('#month-summary').textContent=`${count} ngày đã được giữ lại ♡`;
}
function renderMoods(){$('#moods').replaceChildren();for(const m of moods){const b=document.createElement('button');b.className=`mood ${draft.mood===m[0]?'active':''}`;b.setAttribute('aria-pressed',String(draft.mood===m[0]));b.innerHTML=`<span>${m[1]}</span><small>${m[2]}</small>`;b.onclick=()=>{if(busy)return;draft.mood=m[0];draft.color=m[3];$('#custom-color').value=m[3];markDirty();renderMoods();};$('#moods').append(b);}}
function renderMedia(){for(const url of urls)URL.revokeObjectURL(url);urls=[];const list=$('#media-list');list.replaceChildren();$('#media-count').textContent=`${draft.media.length} tệp`;if(!draft.media.length){const empty=document.createElement('div');empty.className='empty-media';empty.textContent='Thêm một khoảnh khắc cho ngày này ♡';list.append(empty);return;}for(const [i,item]of draft.media.entries()){const wrap=document.createElement('div');wrap.className='media-item';const url=URL.createObjectURL(item.blob);urls.push(url);const el=document.createElement(item.type.startsWith('video/')?'video':'img');el.src=url;if(el.tagName==='VIDEO'){el.controls=true;el.playsInline=true;el.preload='metadata';}else{el.alt=item.name;el.loading='lazy';}const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Bỏ ${item.name}`);remove.onclick=()=>{if(busy)return;draft.media.splice(i,1);markDirty();renderMedia();};wrap.append(el,remove);list.append(wrap);}}
function loadDraft(){const saved=entries.get(selected);draft=saved?{...saved,media:[...saved.media]}:{date:selected,title:'',note:'',mood:'',color:'',media:[]};dirty=false;$('#entry-date').textContent=dateLabel(selected);$('#entry-title').value=draft.title;$('#entry-note').value=draft.note;$('#custom-color').value=draft.color||'#ffe49b';$('#save-status').textContent=saved?'Kỷ niệm đã lưu trong tài khoản này ♡':'Chọn tâm trạng và viết vài dòng nhé.';renderMoods();renderMedia();}
$('#entry-title').oninput=e=>{draft.title=e.target.value;markDirty();};$('#entry-note').oninput=e=>{draft.note=e.target.value;markDirty();};$('#custom-color').oninput=e=>{draft.color=e.target.value;markDirty();};
async function addFiles(e){if(busy){e.target.value='';return;}const files=[...e.target.files];for(const file of files){if(!/^(image|video)\//.test(file.type)){toast('Chỉ hỗ trợ ảnh và video.');continue;}if(file.size>100*1024*1024){toast('Mỗi tệp tối đa 100 MB. Hãy chọn video ngắn hơn.');continue;}draft.media.push({name:file.name,type:file.type,blob:file});markDirty();}e.target.value='';renderMedia();}
for(const id of ['photo-input','video-input','library-input'])$('#'+id).onchange=addFiles;
$('#save').onclick=async()=>{if(busy)return;if(!draft.title.trim()&&!draft.note.trim()&&!draft.mood&&!draft.color&&!draft.media.length){toast('Thêm tâm trạng, màu, ghi chú hoặc một khoảnh khắc nhé.');return;}setBusy(true);$('#entry-title').disabled=true;$('#entry-note').disabled=true;try{const item={...draft,media:[...draft.media],updatedAt:new Date().toISOString()};await writeEntries([item]);entries.set(selected,item);dirty=false;renderCalendar();$('#save-status').textContent='Đã lưu kỷ niệm trong tài khoản này ♡';toast('Đã cất giữ một ngày xinh ♡');navigator.storage?.persist?.().catch(()=>{});}catch{toast('Không lưu được. Bộ nhớ có thể đã đầy; hãy sao lưu và giải phóng dung lượng.');}finally{setBusy(false);$('#entry-title').disabled=false;$('#entry-note').disabled=false;}};
$('#delete-entry').onclick=async()=>{if(busy||!confirm('Xóa nhật ký, màu và tất cả ảnh/video của ngày này?'))return;setBusy(true);try{await writeEntries([],selected);entries.delete(selected);loadDraft();renderCalendar();toast('Đã xóa nhật ký của ngày này.');}catch{toast('Không thể xóa. Vui lòng thử lại.');}finally{setBusy(false);}};
for(const [id,delta]of [['prev',-1],['next',1]])$('#'+id).onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+delta,1);renderCalendar();};
$('#today').onclick=()=>{if(!canLeave())return;selected=key(today);month=new Date(today.getFullYear(),today.getMonth(),1);loadDraft();renderCalendar();};
$('#today-label').textContent=`Hôm nay • ${today.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric',year:'numeric'})}`;
$('#backup-open').onclick=()=>$('#backup-dialog').showModal();
const toDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
$('#export').onclick=async()=>{if(busy)return;if(dirty){toast('Hãy lưu nhật ký đang viết trước khi sao lưu.');return;}setBusy(true);toast('Đang chuẩn bị bản sao lưu…');try{const data=[];for(const entry of entries.values()){const media=[];for(const m of entry.media)media.push({name:m.name,type:m.type,data:await toDataURL(m.blob)});data.push({...entry,media});}const blob=new Blob([JSON.stringify({app:'ngay-xinh',version:1,entries:data})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ngay-xinh-${key(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Đã tạo bản sao lưu. Hãy giữ tệp ở nơi an toàn.');}catch{toast('Không tạo được bản sao lưu. Vui lòng thử lại.');}finally{setBusy(false);}};
function validEntry(e){return e&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!isNaN(dateFromKey(e.date))&&key(dateFromKey(e.date))===e.date&&typeof e.title==='string'&&typeof e.note==='string'&&typeof e.mood==='string'&&(!e.mood||moods.some(m=>m[0]===e.mood))&&typeof e.color==='string'&&(!e.color||/^#[0-9a-f]{6}$/i.test(e.color))&&Array.isArray(e.media);}
$('#import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||!canLeave())return;setBusy(true);try{const data=JSON.parse(await file.text());if(data.app!=='ngay-xinh'||data.version!==1||!Array.isArray(data.entries)||!data.entries.every(validEntry))throw Error('format');const items=[];for(const entry of data.entries){const media=[];for(const m of entry.media){if(typeof m.name!=='string'||typeof m.type!=='string'||!/^(image|video)\/[a-z0-9.+-]+$/i.test(m.type)||typeof m.data!=='string'||!m.data.startsWith(`data:${m.type};base64,`))throw Error('format');const raw=atob(m.data.split(',')[1]);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));media.push({name:m.name,type:m.type,blob:new Blob([bytes],{type:m.type})});}items.push({date:entry.date,title:entry.title,note:entry.note,mood:entry.mood,color:entry.color,media,updatedAt:new Date().toISOString()});}const duplicates=items.filter(x=>entries.has(x.date)).length;if(!confirm(`Khôi phục ${items.length} ngày? ${duplicates} ngày trùng sẽ được thay thế.`))return;await writeEntries(items);for(const item of items)entries.set(item.date,item);loadDraft();renderCalendar();$('#backup-dialog').close();toast('Đã khôi phục kỷ niệm thành công.');}catch{toast('Không khôi phục được: tệp không hợp lệ hoặc bộ nhớ đã đầy.');}finally{setBusy(false);}};
function showAuthView(view){
 const login=view==='login';$('#login-form').hidden=!login;$('#register-form').hidden=login;$('#show-login').classList.toggle('active',login);$('#show-register').classList.toggle('active',!login);$('#show-login').setAttribute('aria-selected',String(login));$('#show-register').setAttribute('aria-selected',String(!login));$('#login-status').textContent='';$('#register-status').textContent='';if(login)setTimeout(()=>$('#login-username').focus(),0);else setTimeout(()=>$('#register-name').focus(),0);
}
function renderAccountList(){
 const list=$('#account-list');list.replaceChildren();const accounts=getAccounts();if(!accounts.length){list.hidden=true;return;}list.hidden=false;const label=document.createElement('span');label.textContent='Tài khoản trên thiết bị:';list.append(label);for(const account of accounts){const b=document.createElement('button');b.type='button';b.className='account-choice';b.textContent=account.displayName||account.username;b.onclick=()=>{$('#login-username').value=account.username;$('#login-password').focus();};list.append(b);}
}
function setAuthFormBusy(value){for(const el of document.querySelectorAll('.auth-form input,.auth-form button,.auth-tab'))el.disabled=value;}
function showAuth(){
 $('#auth-screen').hidden=false;$('#app-main').hidden=true;$('#account-status').hidden=true;$('#backup-open').hidden=true;$('#logout').hidden=true;renderAccountList();showAuthView('login');
}
function showApp(){
 $('#auth-screen').hidden=true;$('#app-main').hidden=false;$('#account-status').hidden=false;$('#backup-open').hidden=false;$('#logout').hidden=false;$('#account-status').textContent=`👤 ${currentUser.displayName||currentUser.username}`;
}
async function startApp(){
 showApp();entries.clear();selected=key(today);month=new Date(today.getFullYear(),today.getMonth(),1);setBusy(false);
 try{for(const e of await readAll())entries.set(e.date,e);loadDraft();renderCalendar();navigator.storage?.persist?.().catch(()=>{});}catch{$('#save-status').textContent='Không mở được bộ nhớ của tài khoản này. Hãy dùng trình duyệt thường và cho phép lưu dữ liệu.';setBusy(true);}
}
async function signIn(account,{migrateLegacy=false}={}){
 await closeDb();currentUser=account;sessionStorage.setItem(SESSION_KEY,account.id);let migrated=0;if(migrateLegacy)migrated=await maybeMigrateLegacy();await startApp();if(migrated)toast(`Đã chuyển ${migrated} ngày cũ vào tài khoản ${account.displayName||account.username}.`);
}

$('#show-login').onclick=()=>showAuthView('login');
$('#show-register').onclick=()=>showAuthView('register');
$('#login-form').onsubmit=async e=>{
 e.preventDefault();const username=normalizeUsername($('#login-username').value),password=$('#login-password').value,status=$('#login-status');status.textContent='';const account=getAccounts().find(a=>a.usernameKey===username);
 if(!account){status.textContent='Không tìm thấy tài khoản này trên thiết bị.';return;}
 setAuthFormBusy(true);try{const digest=await passwordDigest(password,account.salt);if(digest.hash!==account.hash){status.textContent='Mật khẩu không đúng.';return;}$('#login-password').value='';await signIn(account);}catch{status.textContent='Không thể đăng nhập. Vui lòng thử lại.';}finally{setAuthFormBusy(false);}
};
$('#register-form').onsubmit=async e=>{
 e.preventDefault();const displayName=$('#register-name').value.trim(),rawUsername=$('#register-username').value.trim(),usernameKey=normalizeUsername(rawUsername),password=$('#register-password').value,confirmPassword=$('#register-confirm').value,status=$('#register-status');status.textContent='';
 if(!validUsername(rawUsername)){status.textContent='Tên đăng nhập 3–30 ký tự, không có khoảng trắng; chỉ dùng chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.';return;}
 const accounts=getAccounts();if(accounts.some(a=>a.usernameKey===usernameKey)){status.textContent='Tên đăng nhập này đã tồn tại trên thiết bị.';return;}if(password.length<6){status.textContent='Mật khẩu cần ít nhất 6 ký tự.';return;}if(password!==confirmPassword){status.textContent='Hai mật khẩu chưa trùng nhau.';return;}
 setAuthFormBusy(true);try{const digest=await passwordDigest(password);const account={id:randomId(),username:rawUsername,usernameKey,displayName:displayName||rawUsername,salt:digest.salt,hash:digest.hash,createdAt:new Date().toISOString()};saveAccounts([...accounts,account]);$('#register-password').value='';$('#register-confirm').value='';await signIn(account,{migrateLegacy:accounts.length===0});}catch{status.textContent='Không thể tạo tài khoản. Vui lòng thử lại.';}finally{setAuthFormBusy(false);}
};
$('#logout').onclick=async()=>{if(!canLeave())return;sessionStorage.removeItem(SESSION_KEY);for(const url of urls)URL.revokeObjectURL(url);urls=[];entries.clear();draft=null;dirty=false;await closeDb();currentUser=null;showAuth();toast('Đã đăng xuất.');};

addEventListener('beforeunload',e=>{if(currentUser&&(dirty||busy)){e.preventDefault();e.returnValue='';}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
for(const label of document.querySelectorAll('.capture')){label.tabIndex=0;label.setAttribute('role','button');label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();label.querySelector('input').click();}});}

async function initAuth(){const accounts=getAccounts(),session=sessionStorage.getItem(SESSION_KEY),account=accounts.find(a=>a.id===session);if(account){currentUser=account;await startApp();}else showAuth();}
await initAuth();
