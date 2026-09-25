const button=document.querySelector('#ios-install');
const dialog=document.querySelector('#ios-install-dialog');

const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
const isSafari=/Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

function refreshInstallButton(){
  if(!button) return;
  button.hidden=!isIOS || isStandalone();
  button.textContent=isSafari?' Cài trên iPhone':' Mở bằng Safari để cài';
}
refreshInstallButton();
window.addEventListener('pageshow',refreshInstallButton);
document.addEventListener('visibilitychange',refreshInstallButton);

button?.addEventListener('click',()=>{
  if(isStandalone()) return;
  if(!isSafari){
    alert('Để cài ứng dụng trên iPhone, hãy mở trang này bằng Safari rồi chọn Chia sẻ → Thêm vào Màn hình chính.');
    return;
  }
  dialog?.showModal();
});
