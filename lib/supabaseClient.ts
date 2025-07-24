// Export config directly
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yyuhacouxktycsaggyzi.supabase.co';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dWhhY291eGt0eWNzYWdneXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2NTE0MjIsImV4cCI6MjA2MjIyNzQyMn0.ZB_OLJnQdqvHlTUnullWCuyIbJkq6nrwxDYvhco6mtU';

// Optional: Warnings if environment variables are not set
if (supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.warn('Supabase URL is not set via environment variables (EXPO_PUBLIC_SUPABASE_URL). Using hardcoded fallback. Consider using environment variables.');
}
if (supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn('Supabase Anon Key is not set via environment variables (EXPO_PUBLIC_SUPABASE_ANON_KEY). Using hardcoded fallback. Consider using environment variables.');
} 