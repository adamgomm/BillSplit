import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://yyuhacouxktycsaggyzi.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dWhhY291eGt0eWNzYWdneXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2NTE0MjIsImV4cCI6MjA2MjIyNzQyMn0.ZB_OLJnQdqvHlTUnullWCuyIbJkq6nrwxDYvhco6mtU';

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export default supabaseClient; 