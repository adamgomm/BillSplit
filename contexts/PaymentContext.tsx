import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';

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

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

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
    const client = createClient(supabaseUrl, supabaseAnonKey);
    setSupabase(client);
  }, []);

  // Function to clear all payment methods from state
  const clearAllPaymentMethods = useCallback(() => {
    console.log('[PaymentContext] Clearing all payment methods from state.');
    setPaymentMethods([]);
    setError(null);
  }, []);

  // Function to load payment methods from Supabase
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

      // Get payment method from profiles table
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('Payment')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (data?.Payment) {
        // Convert the single payment string to our PaymentMethod format
        const paymentMethod: PaymentMethod = {
          id: '1', // Since we only have one payment method now
          type: data.Payment.startsWith('$') ? 'cashapp' : 'venmo',
          username: data.Payment,
          displayName: data.Payment.startsWith('$') ? 'Cash App' : 'Venmo'
        };
        setPaymentMethods([paymentMethod]);
        console.log('[PaymentContext] Payment method loaded for user:', user.id);
      } else {
        setPaymentMethods([]);
        console.log('[PaymentContext] No payment method found for user:', user.id);
      }
    } catch (err: any) {
      console.error('[PaymentContext] Error loading payment method:', err);
      setError(err.message || 'Failed to load payment method');
    } finally {
      setLoading(false);
    }
  }, [supabase, clearAllPaymentMethods]);

  // Save payment method to Supabase
  const savePaymentMethods = async (methods: PaymentMethod[]) => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Save the username of the first payment method (since we only support one now)
      const paymentUsername = methods.length > 0 ? methods[0].username : null;

      // Update Payment in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ Payment: paymentUsername })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setPaymentMethods(methods);
      console.log('[PaymentContext] Payment method saved for user:', user.id);
    } catch (err: any) {
      console.error('[PaymentContext] Error saving payment method:', err);
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

      // Since we only support one payment method, replace any existing ones
      await savePaymentMethods([newMethod]);
    } catch (err: any) {
      console.error('[PaymentContext] Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removePaymentMethod = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear the payment method
      await savePaymentMethods([]);
    } catch (err: any) {
      console.error('[PaymentContext] Error removing payment method:', err);
      setError(err.message || 'Failed to remove payment method');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    if (!supabase) return;
    
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
      authListener.subscription.unsubscribe();
    };
  }, [supabase, loadPaymentMethods, clearAllPaymentMethods]);

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