import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const params = new URLSearchParams(location.search);
const forceLocal = params.get('mode') === 'local';
const hasSupabase =
  /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL || '') &&
  typeof SUPABASE_PUBLISHABLE_KEY === 'string' &&
  SUPABASE_PUBLISHABLE_KEY.length > 20;

if (hasSupabase && !forceLocal) {
  await import('./app-supabase.js');
} else {
  await import('./app-local.js');
}
