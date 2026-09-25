import {cloudEnabled, accountReady, account, accountError} from './accounts.js';
import {readCloudEntries,writeCloudEntries,mediaURL,mediaBlob} from './cloud-storage.js';
const $ = s => document.querySelector(s);
const moods = [ ['happy','☀️','Vui vẻ','#ffe49b'],['calm','🌿','Bình yên','#cdebd9'],['grateful','💜','Biết ơn','#e2d5fa'],['sad','🌧️','Buồn chút','#d1e5fa'],['stress','🔥','Căng thẳng','#ffd4c4'] ];
const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = new Date(); let selected = key(today), month = new Date(today.getFullYear(),today.getMonth(),1), entries = new Map(), draft, dirty=false, busy=false, urls=[];
const dateFromKey = value => new Date(`${value}T12:00:00`);
const dateLabel = value => dateFromKey(value).toLocaleDateString('vi-VN',{weekday:'long',day:'numeric',month:'long'});
let dbReady; function localDatabase(){return dbReady ||= new Promise((resolve,reject)=>{const r=indexedDB.open('ngay-xinh',1);r.onupgradeneeded=()=>r.result.createObjectStore('entries',{keyPath:'date'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));});}
async function readAll(){if(cloudEnabled)return readCloudEntries();const db=await localDatabase();return new Promise((resolve,reject)=>{const r=db.transaction('entries').objectStore('entries').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function writeEntries(items,remove){if(cloudEnabled)return writeCloudEntries(items,remove);const db=await localDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');if(remove)store.delete(remove);for(const item of items)store.put(item);tx.oncomplete=()=>resolve(items);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
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
function renderMedia(){for(const url of urls)URL.revokeObjectURL(url);urls=[];const list=$('#media-list');list.replaceChildren();$('#media-count').textContent=`${draft.media.length} tệp`;if(!draft.media.length){const empty=document.createElement('div');empty.className='empty-media';empty.textContent='Thêm một khoảnh khắc cho ngày này ♡';list.append(empty);return;}for(const [i,item]of draft.media.entries()){const wrap=document.createElement('div');wrap.className='media-item';const el=document.createElement(item.type.startsWith('video/')?'video':'img');if(item.blob){const url=URL.createObjectURL(item.blob);urls.push(url);el.src=url;}else{mediaURL(item).then(url=>{if(el.isConnected)el.src=url;}).catch(()=>{if(el.isConnected){const message=document.createElement('span');message.className='media-error';message.textContent='Không tải được tệp. Hãy kết nối mạng và mở lại ngày này.';el.replaceWith(message);}});}if(el.tagName==='VIDEO'){el.controls=true;el.playsInline=true;el.preload='metadata';}else{el.alt=item.name;el.loading='lazy';}const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Bỏ ${item.name}`);remove.onclick=()=>{if(busy)return;draft.media.splice(i,1);markDirty();renderMedia();};wrap.append(el,remove);list.append(wrap);}}
function loadDraft(){const saved=entries.get(selected);draft=saved?{...saved,media:[...saved.media]}:{date:selected,title:'',note:'',mood:'',color:'',media:[]};dirty=false;$('#entry-date').textContent=dateLabel(selected);$('#entry-title').value=draft.title;$('#entry-note').value=draft.note;$('#custom-color').value=draft.color||'#ffe49b';$('#save-status').textContent=saved?(cloudEnabled?'Kỷ niệm đã lưu trong tài khoản ♡':'Kỷ niệm đã lưu trên thiết bị này ♡'):'Chọn tâm trạng và viết vài dòng nhé.';renderMoods();renderMedia();}
$('#entry-title').oninput=e=>{draft.title=e.target.value;markDirty();};$('#entry-note').oninput=e=>{draft.note=e.target.value;markDirty();};$('#custom-color').oninput=e=>{draft.color=e.target.value;markDirty();};
async function addFiles(e){if(busy){e.target.value='';return;}const files=[...e.target.files];for(const file of files){if(!/^(image|video)\//.test(file.type)){toast('Chỉ hỗ trợ ảnh và video.');continue;}if(file.size>(cloudEnabled?50:100)*1024*1024){toast(`Mỗi tệp tối đa ${cloudEnabled?50:100} MB. Hãy chọn video ngắn hơn.`);continue;}draft.media.push({name:file.name,type:file.type,blob:file});markDirty();}e.target.value='';renderMedia();}
for(const id of ['photo-input','video-input','library-input'])$('#'+id).onchange=addFiles;
$('#save').onclick=async()=>{if(busy)return;const operationEpoch=accountEpoch;if(!draft.title.trim()&&!draft.note.trim()&&!draft.mood&&!draft.color&&!draft.media.length){toast('Thêm tâm trạng, màu, ghi chú hoặc một khoảnh khắc nhé.');return;}setBusy(true);$('#entry-title').disabled=true;$('#entry-note').disabled=true;try{const item={...draft,media:[...draft.media],updatedAt:new Date().toISOString()};const [saved]=await writeEntries([item]);if(operationEpoch!==accountEpoch)return;entries.set(selected,saved);draft={...saved,media:[...saved.media]};dirty=false;renderCalendar();$('#save-status').textContent=cloudEnabled?'Đã lưu kỷ niệm trong tài khoản ♡':'Đã lưu kỷ niệm trên thiết bị này ♡';toast('Đã cất giữ một ngày xinh ♡');navigator.storage?.persist?.().catch(()=>{});}catch{if(operationEpoch===accountEpoch){$('#save-status').textContent=cloudEnabled?'Chưa lưu được lên tài khoản. Kiểm tra kết nối mạng rồi thử lại; nội dung đang viết vẫn còn.':'Không lưu được. Bộ nhớ có thể đã đầy; hãy sao lưu và giải phóng dung lượng.';toast($('#save-status').textContent);}}finally{if(operationEpoch===accountEpoch){setBusy(false);$('#entry-title').disabled=false;$('#entry-note').disabled=false;}}};
$('#delete-entry').onclick=async()=>{if(busy||!confirm('Xóa nhật ký, màu và tất cả ảnh/video của ngày này?'))return;setBusy(true);try{await writeEntries([],selected);entries.delete(selected);loadDraft();renderCalendar();toast('Đã xóa nhật ký của ngày này.');}catch{toast('Không thể xóa. Vui lòng thử lại.');}finally{setBusy(false);}};
for(const [id,delta]of [['prev',-1],['next',1]])$('#'+id).onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+delta,1);renderCalendar();};
$('#today').onclick=()=>{if(!canLeave())return;selected=key(today);month=new Date(today.getFullYear(),today.getMonth(),1);loadDraft();renderCalendar();};
$('#today-label').textContent=`Hôm nay • ${today.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric',year:'numeric'})}`;
$('#backup-open').onclick=()=>$('#backup-dialog').showModal();
const toDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
$('#export').onclick=async()=>{if(busy)return;if(dirty){toast('Hãy lưu nhật ký đang viết trước khi sao lưu.');return;}setBusy(true);toast('Đang chuẩn bị bản sao lưu…');try{const data=[];for(const entry of entries.values()){const media=[];for(const m of entry.media)media.push({name:m.name,type:m.type,data:await toDataURL(await mediaBlob(m))});data.push({...entry,media});}const blob=new Blob([JSON.stringify({app:'ngay-xinh',version:1,entries:data})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ngay-xinh-${key(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Đã tạo bản sao lưu. Hãy giữ tệp ở nơi an toàn.');}catch{toast('Không tạo được bản sao lưu. Vui lòng thử lại.');}finally{setBusy(false);}};
function validEntry(e){return e&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!isNaN(dateFromKey(e.date))&&key(dateFromKey(e.date))===e.date&&typeof e.title==='string'&&typeof e.note==='string'&&typeof e.mood==='string'&&(!e.mood||moods.some(m=>m[0]===e.mood))&&typeof e.color==='string'&&(!e.color||/^#[0-9a-f]{6}$/i.test(e.color))&&Array.isArray(e.media);}
$('#import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||!canLeave())return;setBusy(true);try{const data=JSON.parse(await file.text());if(data.app!=='ngay-xinh'||data.version!==1||!Array.isArray(data.entries)||!data.entries.every(validEntry))throw Error('format');const items=[];for(const entry of data.entries){const media=[];for(const m of entry.media){if(typeof m.name!=='string'||typeof m.type!=='string'||!/^(image|video)\/[a-z0-9.+-]+$/i.test(m.type)||typeof m.data!=='string'||!m.data.startsWith(`data:${m.type};base64,`))throw Error('format');const raw=atob(m.data.split(',')[1]);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));media.push({name:m.name,type:m.type,blob:new Blob([bytes],{type:m.type})});}items.push({date:entry.date,title:entry.title,note:entry.note,mood:entry.mood,color:entry.color,media,updatedAt:new Date().toISOString()});}const duplicates=items.filter(x=>entries.has(x.date)).length;if(!confirm(`Khôi phục ${items.length} ngày? ${duplicates} ngày trùng sẽ được thay thế.`))return;const savedItems=await writeEntries(items);for(const item of savedItems)entries.set(item.date,item);loadDraft();renderCalendar();$('#backup-dialog').close();toast('Đã khôi phục kỷ niệm thành công.');}catch{toast('Không khôi phục được: tệp không hợp lệ hoặc bộ nhớ đã đầy.');}finally{setBusy(false);}};
addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
let accountEpoch=0;
async function openDiary(){
 const epoch=++accountEpoch;
 setBusy(true);dirty=false;entries.clear();
 for(const url of urls)URL.revokeObjectURL(url);urls=[];
 $('#media-list').replaceChildren();$('#entry-title').value='';$('#entry-note').value='';$('#calendar').replaceChildren();
 draft={date:selected,title:'',note:'',mood:'',color:'',media:[]};
 $('#backup-dialog').close();$('.workspace').hidden=true;$('#backup-open').hidden=true;$('#account-gate').hidden=false;
 $('#gate-login').hidden=true;$('#gate-retry').hidden=true;$('#gate-title').textContent='Đang mở nhật ký…';$('#gate-message').textContent='';
 await accountReady;
 if(epoch!==accountEpoch)return;
 if(cloudEnabled&&!account){
  $('#gate-title').textContent='Nhật ký của riêng bạn ♡';
  $('#gate-message').textContent=accountError?'Chưa kết nối được tài khoản. Hãy tải lại trang và thử lại.':'Đăng nhập để mở những ngày đáng nhớ của bạn.';
  $('#gate-login').hidden=false;return;
 }
 try{
  const records=await readAll();if(epoch!==accountEpoch)return;
  for(const e of records)entries.set(e.date,e);
  loadDraft();renderCalendar();setBusy(false);$('#entry-title').disabled=false;$('#entry-note').disabled=false;
  $('#account-gate').hidden=true;$('.workspace').hidden=false;$('#backup-open').hidden=false;
  $('#privacy-note').textContent=cloudEnabled?'Nhật ký lưu theo tài khoản. Cần kết nối mạng để mở và lưu; hãy đăng xuất khi dùng máy chung.':'Nhật ký chỉ lưu trong trình duyệt trên thiết bị này. Hãy sao lưu thường xuyên; xóa dữ liệu trình duyệt sẽ mất nhật ký.';
 }catch{
  if(epoch!==accountEpoch)return;
  $('#gate-title').textContent='Chưa mở được nhật ký';
  $('#gate-message').textContent=cloudEnabled?'Kiểm tra mạng và thử lại. Dữ liệu đã lưu trong tài khoản không bị xóa.':'Trình duyệt chưa cho phép lưu dữ liệu. Hãy dùng trình duyệt thường và thử lại.';
  $('#gate-retry').hidden=false;
 }
}
await accountReady;
addEventListener('account-changed',openDiary);
await openDiary();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});


for(const label of document.querySelectorAll('.capture')){label.tabIndex=0;label.setAttribute('role','button');label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();label.querySelector('input').click();}});}

