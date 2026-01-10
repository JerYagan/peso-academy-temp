import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please check your .env file.');
  // Don't throw error in development, allow app to run with mock data
  // throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
// Using 'any' type temporarily until database schema is set up
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any) => {
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message || 'An error occurred');
  }
};

