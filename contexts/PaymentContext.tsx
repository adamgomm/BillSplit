import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, supabaseAuthConfig } from '../lib/supabaseClient';

interface PaymentMethod {
  id: string;
  type: 'cashapp' | 'venmo';
  username: string;
  displayName: string;
}

interface PaymentContextType {
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  loadPaymentMethods: () => Promise<void>;
  clearAllPaymentMethods: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

interface PaymentProviderProps {
  children: ReactNode;
}

export const PaymentProvider: React.FC<PaymentProviderProps> = ({ children }) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // Initialize Supabase client
  useEffect(() => {
    const client = createClient(supabaseUrl, supabaseAnonKey, supabaseAuthConfig);
    setSupabase(client);
  }, []);

  // Function to clear all payment methods from state
  const clearAllPaymentMethods = useCallback(() => {
    console.log('[PaymentContext] Clearing all payment methods from state.');
    setPaymentMethods([]);
    setError(null);
  }, []);

  // Function to load payment methods for the current user
  const loadPaymentMethods = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[PaymentContext] No user session found, clearing payment methods.');
        clearAllPaymentMethods();
        setLoading(false);
        return;
      }

      const storageKey = `paymentMethods_${user.id}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const userPaymentMethods = JSON.parse(stored);
        setPaymentMethods(userPaymentMethods);
        console.log('[PaymentContext] Payment methods loaded for user:', user.id, 'Count:', userPaymentMethods.length);
      } else {
        setPaymentMethods([]);
        console.log('[PaymentContext] No payment methods found for user:', user.id);
      }
    } catch (err: any) {
      console.error('Error loading payment methods:', err);
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, [supabase, clearAllPaymentMethods]);

  // Listen to auth state changes to fetch/clear data automatically
  useEffect(() => {
    if (!supabase) return;
    
    // Fetch initial data on load
    loadPaymentMethods();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[PaymentContext] Auth state changed: ${event}`);
      if (event === 'SIGNED_IN') {
        loadPaymentMethods();
      }
      if (event === 'SIGNED_OUT') {
        clearAllPaymentMethods();
      }
    });

    return () => {
      // Cleanup the listener on component unmount
      authListener.subscription.unsubscribe();
    };
  }, [supabase, loadPaymentMethods, clearAllPaymentMethods]);

  const savePaymentMethods = async (methods: PaymentMethod[]) => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Save payment methods with user-specific key
      const storageKey = `paymentMethods_${user.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(methods));
      setPaymentMethods(methods);
      console.log('[PaymentContext] Payment methods saved for user:', user.id);
    } catch (err: any) {
      console.error('Error saving payment methods:', err);
      throw new Error(err.message || 'Failed to save payment method');
    }
  };

  const addPaymentMethod = useCallback(async (method: Omit<PaymentMethod, 'id'>) => {
    try {
      setLoading(true);
      setError(null);
      
      const newMethod: PaymentMethod = {
        ...method,
        id: Date.now().toString(),
      };

      const updatedMethods = [...paymentMethods, newMethod];
      await savePaymentMethods(updatedMethods);
    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [paymentMethods]);

  const removePaymentMethod = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedMethods = paymentMethods.filter(method => method.id !== id);
      await savePaymentMethods(updatedMethods);
    } catch (err: any) {
      console.error('Error removing payment method:', err);
      setError(err.message || 'Failed to remove payment method');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [paymentMethods]);

  const value: PaymentContextType = {
    paymentMethods,
    loading,
    error,
    addPaymentMethod,
    removePaymentMethod,
    loadPaymentMethods,
    clearAllPaymentMethods,
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};

export const usePayment = (): PaymentContextType => {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
}; 