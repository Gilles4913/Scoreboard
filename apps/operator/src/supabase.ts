import { createClient } from '@supabase/supabase-js';

console.log('🔧 Supabase - Initialisation du client');

// Configuration directe avec les valeurs du .env.example
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://opwjfpybcgtgcvldizar.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wd2pmcHliY2d0Z2N2bGRpemFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTQ5MTksImV4cCI6MjA3MzA3MDkxOX0.8yrYMlhFmjAF5_LG9FtCx8XrJ1sFOz2YejDDupbhgpY';

console.log('🔑 Supabase - Configuration:', { 
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ MANQUANT', 
  key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : '❌ MANQUANT' 
});

if (!supabaseUrl) {
  console.error('❌ Supabase - VITE_SUPABASE_URL manquant');
  throw new Error('VITE_SUPABASE_URL is required. Please check your .env file.');
}

if (!supabaseAnonKey) {
  console.error('❌ Supabase - VITE_SUPABASE_ANON_KEY manquant');
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Please check your .env file.');
}

console.log('✅ Supabase - Création du client');
export const supa = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

console.log('🚀 Supabase - Client créé avec succès');