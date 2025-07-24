import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import createClient and config, not the client itself
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  // State to hold the initialized client
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  // Add refs for TextInput components
  const passwordRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // --- Initialize Supabase Client and Check for Existing Session ---
  useEffect(() => {
    const initializeAndCheckSession = async () => {
      // Use dynamic import for AsyncStorage to be SSR-safe
      const storage = (await import('@react-native-async-storage/async-storage')).default;
      
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
      setSupabaseClient(client);
      console.log('[LoginScreen] Supabase client initialized.');

      // Check for an existing session
      const { data: { session } } = await client.auth.getSession();
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (session && userToken) {
        console.log('[LoginScreen] Active session found, redirecting to app...');
        router.replace('/(tabs)/home');
      } else {
        // Clear any lingering data if we're on the login screen without a valid session
        console.log('[LoginScreen] No active session. Clearing any lingering data...');
        await AsyncStorage.clear();
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        setUsername('');
        setConfirmPassword('');
      }
    };
    
    initializeAndCheckSession();
  }, []);

  // --- Handle Login ---
  const handleLogin = async () => {
    if (!supabaseClient) {
      Alert.alert("Error", "Supabase client not initialized yet.");
      return;
    }
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email/username and password');
      return;
    }
    setLoading(true);
    let userEmailToLogin = email;

    try {
      // Clear any existing data before login
      console.log('[LoginScreen] Clearing storage before login');
      await AsyncStorage.clear();

      if (!email.includes('@')) {
        console.log(`Login attempt with username: ${email}`);
        const { data: profileData, error: profileError } = await supabaseClient
          .from('profiles')
          .select('email')
          .eq('username', email)
          .single();

        if (profileError || !profileData) {
          console.error('Error fetching profile by username or profile not found:', profileError);
          Alert.alert('Login Failed', 'Invalid username or password.');
          setLoading(false);
          return;
        }
        userEmailToLogin = profileData.email;
        console.log(`Found email ${userEmailToLogin} for username ${email}`);
      } else {
        console.log(`Login attempt with email: ${email}`);
      }

      const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: userEmailToLogin,
        password: password,
      });

      if (authError) throw authError;

      if (data.session && data.user) {
        console.log(`[LoginScreen] Login successful for user: ${data.user.id}`);
        
        // Store session data
        await AsyncStorage.setItem('userToken', data.session.access_token);
        await AsyncStorage.setItem('userEmail', data.user.email || userEmailToLogin);
        await AsyncStorage.setItem('userId', data.user.id); // Store user ID for context isolation

        const { data: userProfile, error: fetchProfileError } = await supabaseClient
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single();

        if (fetchProfileError) {
          console.error('Error fetching username after login:', fetchProfileError);
        } else if (userProfile && userProfile.username) {
          await AsyncStorage.setItem('username', userProfile.username);
        } else {
          if(!email.includes('@')) {
            await AsyncStorage.setItem('username', email); 
          }
        }

        console.log('[LoginScreen] User data stored, navigating to app');
        
        // Clear form data
        setEmail('');
        setPassword('');
        setUsername('');
        setConfirmPassword('');
      }
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('Login error:', error.message);
      Alert.alert('Login Failed', 'Invalid email/username or password.');
    } finally {
      setLoading(false);
    }
  };

  // --- Handle Sign Up ---
  const handleSignUp = async () => {
    if (!supabaseClient) { // Check if client is ready
      Alert.alert("Error", "Supabase client not initialized yet.");
      return;
    }
    if (!email || !password || !confirmPassword || (isSignUp && !username)) {
      Alert.alert('Error', 'Please fill in all fields, including username for sign up');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    console.log('Signing up with email:', email, 'and username:', username);
    
    try {
      // Clear any existing data before signup
      console.log('[LoginScreen] Clearing storage before signup');
      await AsyncStorage.clear();

      // Use client from state
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data.user && data.session) {
        console.log(`[LoginScreen] Signup successful for user: ${data.user.id}`);
        
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .update({ username: username })
          .eq('id', data.user.id);

        if (profileError) {
          console.error('Error updating profile with username:', profileError);
          Alert.alert('Sign Up Successful (with issue)', 'Account created but failed to save username. Please try updating it in your profile later.');
        }
        
        // Store session data
        await AsyncStorage.setItem('userToken', data.session.access_token);
        await AsyncStorage.setItem('userEmail', data.user.email || email);
        await AsyncStorage.setItem('username', username);
        await AsyncStorage.setItem('userId', data.user.id); // Store user ID for context isolation

        console.log('[LoginScreen] New user data stored, navigating to app');
        
        Alert.alert('Sign Up Successful', 'Account created and logged in.');
        
        // Clear form data
        setEmail('');
        setPassword('');
        setUsername('');
        setConfirmPassword('');
        
        router.replace('/(tabs)/home');
      } else if (data.user && !data.session) {
        Alert.alert('Sign Up Successful', 'Please check your email to confirm your account. Username will be set upon confirmation if your setup supports it.');
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
      } else {
         Alert.alert('Sign Up', 'Sign up process completed, but session status unclear. Please try logging in.');
         setIsSignUp(false);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Failed', error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!loading && supabaseClient) {
      if (isSignUp) {
        handleSignUp();
      } else {
        handleLogin();
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>BillSplit</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.heading}>{isSignUp ? 'Register' : 'Login'}</Text>

        {/* Email Input (Common) */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email or Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email or username"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            returnKeyType={isSignUp ? "next" : "done"}
            onSubmitEditing={() => {
              if (isSignUp) {
                usernameRef.current?.focus();
              } else {
                passwordRef.current?.focus();
              }
            }}
            blurOnSubmit={false}
          />
        </View>

        {/* Username Input (Sign Up Only) */}
        {isSignUp && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              ref={usernameRef}
              style={styles.input}
              placeholder="Choose a username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
        )}

        {/* Password Input (Common) */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            returnKeyType={isSignUp ? "next" : "done"}
            onSubmitEditing={() => {
              if (isSignUp) {
                confirmPasswordRef.current?.focus();
              } else {
                handleSubmit();
              }
            }}
            blurOnSubmit={!isSignUp}
          />
        </View>

        {/* Confirm Password Input (Sign Up Only) */}
        {isSignUp && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              ref={confirmPasswordRef}
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        )}

        {/* Action Button (Login or Sign Up) */}
        <TouchableOpacity
          style={[styles.button, (loading || !supabaseClient) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !supabaseClient}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'Register' : 'Login'}</Text>
          )}
        </TouchableOpacity>

        {/* Toggle Text */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={() => {
            if (!loading) {
              setIsSignUp(!isSignUp);
            }
          }} disabled={loading}>
            <Text style={styles.registerLink}>{isSignUp ? 'Login' : 'Register'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5D3FD3',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5, // Keep elevation for Android shadow
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    marginTop: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  button: {
    backgroundColor: '#5D3FD3',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#A090E0', // Lighter color when disabled
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: '#666',
    fontSize: 16,
  },
  registerLink: {
    color: '#5D3FD3',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 