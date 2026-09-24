import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const forceLocal = new URLSearchParams(location.search).get('mode') === 'local';
const hasSupabase = /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL || '') && typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 20;

if (hasSupabase && !forceLocal) {
  await import('./app-supabase.js');
} else {
  await import('./app-local.js');
}
