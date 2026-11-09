import { createClient } from '@supabase/supabase-js';
import type { TrainingDatabase } from '@/types/training-database';

let client: ReturnType<typeof createClient<TrainingDatabase>> | null = null;

export function isTrainingSupabaseConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_TRAINING_SUPABASE_URL && process.env.EXPO_PUBLIC_TRAINING_SUPABASE_PUBLISHABLE_KEY);
}

export function getTrainingSupabase() {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_TRAINING_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_TRAINING_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Configura EXPO_PUBLIC_TRAINING_SUPABASE_URL y EXPO_PUBLIC_TRAINING_SUPABASE_PUBLISHABLE_KEY para activar entrenamientos.');
  }
  client = createClient<TrainingDatabase>(url, publishableKey, {
    auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: false },
  });
  return client;
}
