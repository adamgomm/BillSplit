import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { AuthError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseClient from '../lib/supabaseClient';
import { router } from 'expo-router';

// Define the Expense type (ensure consistency across the app)
interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string; // Consider using Date object if more manipulation is needed
  paidBy: string; // Could be 'You' or a friend's name/ID
  splitWith: string[]; // Array of friend names/IDs involved
}

// Define the shape of the context data
interface ExpenseContextType {
  expenses: Expense[];
  addNewExpense: (newExpense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (idToDelete: string) => Promise<void>;
  clearAllExpenses: () => void;
  refreshExpenses: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Create the context with a default value (can be undefined or null initially)
const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

// Define the props for the provider component
interface ExpenseProviderProps {
  children: ReactNode;
}

// Sample Data (can be moved or replaced with actual data loading)
// const sampleExpenses: Expense[] = [
//     {
//       id: '1',
//       title: 'Dinner at Italian Restaurant',
//       amount: 120,
//       date: '2023-03-22',
//       paidBy: 'You',
//       splitWith: ['Alex', 'Maria', 'John']
//     },
//     {
//       id: '2',
//       title: 'Hotel Room',
//       amount: 250,
//       date: '2023-03-21',
//       paidBy: 'Alex',
//       splitWith: ['You', 'Maria']
//     },
//     {
//       id: '3',
//       title: 'Taxi Ride',
//       amount: 45,
//       date: '2023-03-20',
//       paidBy: 'You',
//       splitWith: ['Alex', 'John']
//     }
// ];


// Create the provider component
export const ExpenseProvider: React.FC<ExpenseProviderProps> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Function to clear all expenses from state
  const clearAllExpenses = useCallback(() => {
    console.log('[ExpenseContext] Clearing all expenses from state.');
    setExpenses([]);
    setError(null);
    setCurrentUserId(null);
  }, []);
  
  // Function to fetch expenses from Supabase
  const fetchExpenses = useCallback(async (forceRefresh = false) => {
    console.log('[ExpenseContext] Attempting to fetch expenses...');
    setLoading(true);
    setError(null);

    try {
      // Clear existing expenses before fetching new ones
      setExpenses([]);
      
      // Check session first
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) throw sessionError;
      
      if (!session) {
        console.log('[ExpenseContext] No session found. Clearing expenses.');
        clearAllExpenses();
        router.replace('/login');
        return;
      }

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        console.log('[ExpenseContext] No user found. Clearing expenses.');
        clearAllExpenses();
        router.replace('/login');
        return;
      }

      // If we're already showing expenses for this user and not forcing refresh, don't reload
      if (!forceRefresh && currentUserId === user.id) {
        console.log('[ExpenseContext] Already showing expenses for current user:', user.id);
        setLoading(false);
        return;
      }

      console.log('[ExpenseContext] Fetching expenses for user:', user.id, 'Previous user:', currentUserId);

      const { data, error: fetchError } = await supabaseClient
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformedExpenses = data?.map(expense => ({
        id: expense.id.toString(),
        title: expense.title,
        amount: expense.amount,
        date: expense.date,
        paidBy: expense.paid_by,
        splitWith: expense.split_with || []
      })) || [];

      setCurrentUserId(user.id);
      setExpenses(transformedExpenses);
      console.log('[ExpenseContext] Expenses fetched successfully for user:', user.id, 'Count:', transformedExpenses.length);
    } catch (err: any) {
      console.error('[ExpenseContext] Error fetching expenses:', err);
      if (err instanceof AuthError || err.message?.includes('auth') || err.message?.includes('session')) {
        console.log('[ExpenseContext] Auth error detected, redirecting to login');
        clearAllExpenses();
        router.replace('/login');
      }
      setError(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [clearAllExpenses, currentUserId]);
  
  // Public refresh function
  const refreshExpenses = useCallback(async () => {
    console.log('[ExpenseContext] Manual refresh requested');
    await fetchExpenses(true);
  }, [fetchExpenses]);
  
  // Listen to auth state changes
  useEffect(() => {
    // Set up auth state change listener
    const { data: authListener } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log(`[ExpenseContext] Auth state changed: ${event}, current user: ${currentUserId}, session user: ${session?.user.id}`);
      
      if (event === 'SIGNED_IN') {
        // Always force a refresh on sign in
        console.log('[ExpenseContext] New sign in detected, forcing expense refresh');
        await fetchExpenses(true);
      } else if (event === 'SIGNED_OUT') {
        console.log('[ExpenseContext] User signed out, clearing expenses');
        clearAllExpenses();
      } else if (event === 'USER_DELETED' || event === 'USER_UPDATED') {
        console.log('[ExpenseContext] User updated/deleted, refreshing expenses');
        await fetchExpenses(true);
      } else if (event === 'INITIAL_SESSION' && session) {
        // Handle case where session already exists on initialization
        console.log('[ExpenseContext] Initial session detected, fetching expenses');
        await fetchExpenses(true);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Handle token refresh which might happen during login
        console.log('[ExpenseContext] Token refreshed, checking if user changed');
        if (session.user.id !== currentUserId) {
          console.log('[ExpenseContext] User changed after token refresh, fetching expenses');
          await fetchExpenses(true);
        }
      }
    });

    // Initial fetch - this will handle cases where auth is already established
    const checkInitialAuth = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        console.log('[ExpenseContext] Initial auth check: session found, fetching expenses');
        await fetchExpenses(true);
      } else {
        console.log('[ExpenseContext] Initial auth check: no session found');
      }
    };
    
    checkInitialAuth();

    return () => {
      console.log('[ExpenseContext] Cleaning up auth listener');
      authListener.subscription.unsubscribe();
    };
  }, [fetchExpenses, clearAllExpenses]);

  // Function to add a new expense
  const addNewExpense = useCallback(async (newExpenseData: Omit<Expense, 'id'>) => {
    try {
      setLoading(true);
      setError(null);

      // Check session first
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) throw sessionError;
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('[ExpenseContext] Adding expense for user:', user.id);

      const insertData = {
        title: newExpenseData.title,
        amount: newExpenseData.amount,
        date: newExpenseData.date,
        paid_by: newExpenseData.paidBy,
        split_with: newExpenseData.splitWith,
        user_id: user.id,
        created_at: new Date().toISOString()
      };

      const { data, error: insertError } = await supabaseClient
        .from('expenses')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      const newExpense: Expense = {
        id: data.id.toString(),
        title: data.title,
        amount: data.amount,
        date: data.date,
        paidBy: data.paid_by,
        splitWith: data.split_with || []
      };

      setExpenses(prevExpenses => [newExpense, ...prevExpenses]);
      console.log('[ExpenseContext] Expense added successfully:', newExpense.id);
    } catch (err: any) {
      console.error('[ExpenseContext] Error adding expense:', err);
      if (err instanceof AuthError || err.message?.includes('auth') || err.message?.includes('session')) {
        router.replace('/login');
      }
      setError(err.message || 'Failed to add expense');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to delete an expense
  const deleteExpense = useCallback(async (idToDelete: string) => {
    try {
      setLoading(true);
      setError(null);

      // Check session first
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) throw sessionError;
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: deleteError } = await supabaseClient
        .from('expenses')
        .delete()
        .eq('id', idToDelete)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== idToDelete));
      console.log('[ExpenseContext] Expense deleted successfully:', idToDelete);
    } catch (err: any) {
      console.error('[ExpenseContext] Error deleting expense:', err);
      if (err instanceof AuthError || err.message?.includes('auth') || err.message?.includes('session')) {
        router.replace('/login');
      }
      setError(err.message || 'Failed to delete expense');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    expenses,
    addNewExpense,
    deleteExpense,
    clearAllExpenses,
    refreshExpenses,
    loading,
    error,
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
};

// Custom hook to use the Expense context
export const useExpenses = (): ExpenseContextType => {
  const context = useContext(ExpenseContext);
  if (context === undefined) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
}; 