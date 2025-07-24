import React, { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';

// Context Providers
import { ThemeProvider } from '../contexts/ThemeContext';
import { ExpenseProvider } from '../contexts/ExpenseContext';
import { PaymentProvider } from '../contexts/PaymentContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
export function AntDesign(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      const { data: { session } } = await client.auth.getSession();
      const userToken = await AsyncStorage.getItem('userToken');

      if (!session || !userToken) {
        // No valid session, redirect to index (login) screen
        console.log('[RootLayout] No valid session found, redirecting to login...');
        router.replace('/');
      }
    } catch (error) {
      console.error('[RootLayout] Error checking auth state:', error);
      // On error, safely redirect to login
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <ExpenseProvider>
        <PaymentProvider>
          <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen 
                name="newGroup" 
                options={{ 
                  headerShown: true,
                  presentation: 'modal', 
                  title: 'Create New Group' 
                }} 
              />
              <Stack.Screen 
                name="payment-methods" 
                options={{ 
                  headerShown: true,
                  presentation: 'modal', 
                  title: 'Payment Methods' 
                }} 
              />
              <Stack.Screen 
                name="settle-up" 
                options={{ 
                  headerShown: true,
                  presentation: 'modal', 
                  title: 'Settle Up' 
                }} 
              />
              <Stack.Screen 
                name="edit-profile" 
                options={{ 
                  headerShown: true,
                  presentation: 'modal', 
                  title: 'Edit Profile' 
                }} 
              />
            </Stack>
          </NavigationThemeProvider>
        </PaymentProvider>
      </ExpenseProvider>
    </ThemeProvider>
  );
}
