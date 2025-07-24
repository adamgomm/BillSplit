import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, supabaseAuthConfig } from '../lib/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // Initialize Supabase client
  useEffect(() => {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    setSupabase(client);
    console.log('[ExpenseContext] Supabase client initialized.');
  }, []);

  // Function to clear all expenses from state
  const clearAllExpenses = useCallback(() => {
    console.log('[ExpenseContext] Clearing all expenses from state.');
    setExpenses([]);
    setError(null);
  }, []);
  
  // Function to fetch expenses from Supabase
  const fetchExpenses = useCallback(async () => {
    if (!supabase) return;

    console.log('[ExpenseContext] Attempting to fetch expenses...');
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[ExpenseContext] No user session found. Clearing expenses.');
        clearAllExpenses();
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const transformedExpenses = data?.map(expense => ({
        id: expense.id.toString(),
        title: expense.title,
        amount: expense.amount,
        date: expense.date,
        paidBy: expense.paid_by,
        splitWith: expense.split_with || []
      })) || [];

      setExpenses(transformedExpenses);
      console.log('[ExpenseContext] Expenses fetched successfully for user:', user.id, 'Count:', transformedExpenses.length);
    } catch (err: any) {
      console.error('[ExpenseContext] Error fetching expenses:', err);
      setError(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [supabase, clearAllExpenses]);
  
  // Listen to auth state changes to fetch/clear data automatically
  useEffect(() => {
    if (!supabase) return;

    // Fetch initial data on load
    fetchExpenses();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[ExpenseContext] Auth state changed: ${event}`);
      if (event === 'SIGNED_IN') {
        fetchExpenses();
      }
      if (event === 'SIGNED_OUT') {
        clearAllExpenses();
      }
    });

    return () => {
      // Cleanup the listener on component unmount
      authListener.subscription.unsubscribe();
    };
  }, [supabase, fetchExpenses, clearAllExpenses]);

  // Function to add a new expense
  const addNewExpense = useCallback(async (newExpenseData: Omit<Expense, 'id'>) => {
    if (!supabase) {
      setError('Supabase client not initialized');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('[ExpenseContext] User authenticated:', user.id);
      console.log('[ExpenseContext] Raw expense data:', newExpenseData);

      // Prepare the data to insert
      const insertData = {
        title: newExpenseData.title,
        amount: newExpenseData.amount,
        date: newExpenseData.date,
        paid_by: newExpenseData.paidBy,
        split_with: newExpenseData.splitWith,
        user_id: user.id,
        created_at: new Date().toISOString()
      };

      console.log('[ExpenseContext] Data to insert:', insertData);

      // Insert into Supabase
      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('[ExpenseContext] Insert error details:', insertError);
        console.error('[ExpenseContext] Error code:', insertError.code);
        console.error('[ExpenseContext] Error message:', insertError.message);
        console.error('[ExpenseContext] Error details:', insertError.details);
        console.error('[ExpenseContext] Error hint:', insertError.hint);
        throw insertError;
      }

      console.log('[ExpenseContext] Insert successful, returned data:', data);

      // Transform the returned data to match our Expense interface
      const newExpense: Expense = {
        id: data.id.toString(),
        title: data.title,
        amount: data.amount,
        date: data.date,
        paidBy: data.paid_by,
        splitWith: data.split_with || []
      };

      // Update local state
      setExpenses(prevExpenses => [newExpense, ...prevExpenses]);
      console.log('[ExpenseContext] Expense added successfully:', newExpense);
    } catch (err: any) {
      console.error('[ExpenseContext] Error adding expense:', err);
      console.error('[ExpenseContext] Full error object:', JSON.stringify(err, null, 2));
      setError(err.message || 'Failed to add expense');
      throw err; // Re-throw to allow UI to handle the error
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Function to delete an expense
  const deleteExpense = useCallback(async (idToDelete: string) => {
    if (!supabase) {
      setError('Supabase client not initialized');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Delete from Supabase
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', idToDelete)
        .eq('user_id', user.id); // Ensure user can only delete their own expenses

      if (deleteError) {
        throw deleteError;
      }

      // Update local state
      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== idToDelete));
      console.log('[ExpenseContext] Expense deleted successfully:', idToDelete);
    } catch (err: any) {
      console.error('[ExpenseContext] Error deleting expense:', err);
      setError(err.message || 'Failed to delete expense');
      throw err; // Re-throw to allow UI to handle the error
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Value provided by the context
  const value = {
    expenses,
    addNewExpense,
    deleteExpense,
    clearAllExpenses,
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