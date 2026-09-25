import { supabaseUrl, supabasePublishableKey } from './config.js';

export const cloudEnabled = Boolean(supabaseUrl && supabasePublishableKey);
export let client = null;
export let account = null;
export let accountError = null;
let recovery = false;
let sessionId = null;
const $ = selector => document.querySelector(selector);
const redirectTo = new URL('./', location.href).href;

export function authMessage(error) {
  if (!navigator.onLine) return 'Bạn đang ngoại tuyến. Kết nối mạng rồi thử lại nhé.';
  const code = error?.code || '';
  if (code === 'invalid_credentials') return 'Email hoặc mật khẩu chưa đúng.';
  if (code === 'email_not_confirmed') return 'Hãy mở email xác nhận tài khoản trước khi đăng nhập.';
  if (code.includes('rate_limit')) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát.';
  if (code === 'weak_password') return 'Mật khẩu chưa đủ mạnh. Hãy dùng ít nhất 8 ký tự.';
  return 'Chưa kết nối được tài khoản. Vui lòng kiểm tra mạng và thử lại.';
}

function updateAccountUI() {
  $('#account-open').textContent = account ? '♡ Tài khoản của tôi' : '♡ Đăng nhập';
  $('#account-identity').textContent = account?.email || '';
  $('#account-signed-in').hidden = !account || recovery;
  $('#auth-form').hidden = Boolean(account) && !recovery;
  $('#auth-password-label').textContent = recovery ? 'Mật khẩu mới' : 'Mật khẩu';
  $('#auth-email-row').hidden = recovery;
  $('#auth-password').autocomplete = recovery ? 'new-password' : 'current-password';
  $('#auth-submit').textContent = recovery ? 'Lưu mật khẩu mới' : 'Đăng nhập';
  $('#auth-register').hidden = recovery;
  $('#auth-reset').hidden = recovery;
  $('#auth-title').textContent = recovery ? 'Đặt mật khẩu mới' : 'Một góc riêng của bạn ♡';
  $('#auth-unconfigured').hidden = cloudEnabled;
  if (!cloudEnabled) $('#auth-form').hidden = true;
}

export const accountReady = (async () => {
  if (!cloudEnabled) return;
  try {
    const { createClient } = await import('./vendor/supabase.js');
    client = createClient(supabaseUrl, supabasePublishableKey);
    // Register synchronously; never call another auth method from this callback.
    client.auth.onAuthStateChange((event, session) => {
      const next = session?.user || null;
      const changed = next?.id !== sessionId;
      sessionId = next?.id;
      account = next;
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      updateAccountUI();
      if (recovery && !$('#account-dialog').open) $('#account-dialog').showModal();
      if (changed) dispatchEvent(new Event('account-changed'));
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    account = data.session?.user || null;
    sessionId = account?.id;
  } catch (error) {
    accountError = error;
  }
})();

$('#account-open').onclick = () => { updateAccountUI(); $('#account-dialog').showModal(); };
$('#gate-login').onclick = () => $('#account-open').click();
$('#gate-retry').onclick = () => dispatchEvent(new Event('account-changed'));
let authBusy = false;
async function runAuth(action) {
  if (authBusy || !client) return;
  authBusy = true;
  for (const button of $('#account-dialog').querySelectorAll('button')) button.disabled = true;
  $('#auth-message').textContent = 'Đang xử lý…';
  try { await action(); }
  catch (error) { $('#auth-message').textContent = authMessage(error); }
  finally {
    authBusy = false;
    for (const button of $('#account-dialog').querySelectorAll('button')) button.disabled = false;
    $('#auth-password').value = '';
  }
}
const credentials = () => ({ email: $('#auth-email').value.trim(), password: $('#auth-password').value });
$('#auth-form').onsubmit = event => {
  event.preventDefault();
  runAuth(async () => {
    const result = recovery
      ? await client.auth.updateUser({ password: $('#auth-password').value })
      : await client.auth.signInWithPassword(credentials());
    if (result.error) throw result.error;
    recovery = false;
    updateAccountUI();
    $('#auth-message').textContent = 'Đã đăng nhập thành công.';
    $('#account-dialog').close();
  });
};
$('#auth-register').onclick = () => {
  if (!$('#auth-form').reportValidity()) return;
  runAuth(async () => {
    const { data, error } = await client.auth.signUp({ ...credentials(), options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
    $('#auth-message').textContent = data.session ? 'Tài khoản đã sẵn sàng.' : 'Hãy kiểm tra email để xác nhận tài khoản, sau đó quay lại đăng nhập.';
    if (data.session) $('#account-dialog').close();
  });
};
$('#auth-reset').onclick = () => {
  if (!$('#auth-email').reportValidity()) return;
  runAuth(async () => {
    const { error } = await client.auth.resetPasswordForEmail($('#auth-email').value.trim(), { redirectTo });
    if (error) throw error;
    $('#auth-message').textContent = 'Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.';
  });
};
$('#auth-signout').onclick = () => {
  if (!confirm('Đăng xuất tài khoản? Các thay đổi chưa lưu sẽ bị bỏ.')) return;
  runAuth(async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    $('#auth-email').value = '';
    $('#auth-message').textContent = 'Đã đăng xuất trên thiết bị này.';
    $('#account-dialog').close();
  });
};
updateAccountUI();
