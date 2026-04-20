import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials missing. Document uploads will fail.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Generate a signed URL valid for 1 hour (3600 seconds)
 */
export async function getSignedUrl(path) {
  if (!path) return null;
  try {
    const { data, error } = await supabaseAdmin.storage.from('documents').createSignedUrl(path, 3600);
    if (error) {
      console.error('Error creating signed URL:', error.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error('Exception creating signed URL:', e);
    return null;
  }
}
