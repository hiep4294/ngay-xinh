import { client, account } from './accounts.js';
const bucket = 'diary-media';
const userId = () => { if (!account) throw new Error('Bạn cần đăng nhập.'); return account.id; };
const check = result => { if (result.error) throw result.error; return result.data; };
const fromRow = row => ({date:row.date,title:row.title,note:row.note,mood:row.mood,color:row.color,media:row.media,updatedAt:row.updated_at});

export async function readCloudEntries() {
  const id = userId(), entries = [];
  for (let start = 0; ; start += 500) {
    const rows = check(await client.from('diary_entries').select('*').eq('user_id', id).order('date').range(start, start + 499));
    entries.push(...rows.map(fromRow));
    if (rows.length < 500) return entries;
  }
}

export async function mediaURL(media) {
  if (media.blob) return URL.createObjectURL(media.blob);
  const id = userId();
  if (!media.path?.startsWith(id + '/')) throw new Error('Không có quyền đọc tệp.');
  return check(await client.storage.from(bucket).createSignedUrl(media.path, 3600)).signedUrl;
}
export async function mediaBlob(media) {
  if (media.blob) return media.blob;
  const id = userId();
  if (!media.path?.startsWith(id + '/')) throw new Error('Không có quyền đọc tệp.');
  return check(await client.storage.from(bucket).download(media.path));
}

export async function writeCloudEntries(items, remove) {
  const id = userId();
  if (remove) {
    // Metadata deletion succeeds before removing objects; a network interruption
    // must never leave a visible entry pointing to already-deleted attachments.
    const rows = check(await client.from('diary_entries').delete().eq('user_id', id).eq('date', remove).select('media'));
    const paths = rows.flatMap(row => row.media.map(m => m.path)).filter(p => p?.startsWith(id + '/'));
    if (paths.length) await client.storage.from(bucket).remove(paths);
    return [];
  }
  const uploaded = [], rows = [];
  let metadataAttempted = false;
  try {
    for (const entry of items) {
      const media = [];
      for (const file of entry.media) {
        let path = file.path;
        if (file.blob) {
          path = `${id}/${entry.date}/${crypto.randomUUID()}`;
          check(await client.storage.from(bucket).upload(path, file.blob, { contentType:file.type, upsert:false }));
          uploaded.push(path);
        }
        if (!path?.startsWith(id + '/')) throw new Error('Không có quyền ghi tệp.');
        media.push({name:file.name,type:file.type,path});
      }
      rows.push({user_id:id,date:entry.date,title:entry.title,note:entry.note,mood:entry.mood,color:entry.color,media,updated_at:new Date().toISOString()});
    }
    if (userId() !== id) throw new Error('Tài khoản đã thay đổi.');
    // One database statement keeps a backup import atomic at the metadata level.
    metadataAttempted = true;
    const saved = check(await client.from('diary_entries').upsert(rows, {onConflict:'user_id,date'}).select());
    return saved.map(fromRow);
  } catch (error) {
    // Leave existing attachments untouched. Newly uploaded, unreferenced files
    // are cleaned on a best-effort basis if saving metadata failed.
    // A lost response may hide a successful commit. Never remove attachments
    // after an ambiguous metadata request; retaining an orphan is safer.
    if (!metadataAttempted && uploaded.length) await client.storage.from(bucket).remove(uploaded).catch(() => {});
    throw error;
  }
}
