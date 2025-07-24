import React from 'react';
import { StyleSheet, FlatList, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useRouter } from 'expo-router';

// Define the navigation type for better type safety
type RootStackParamList = {
  Home: undefined;
  AddExpense: AddExpenseParams;
  newGroup: undefined;
  dashboard: undefined;
  // Add other screens as needed
};

// Create a properly typed navigation hook
type NavigationProp = import('@react-navigation/native-stack').NativeStackNavigationProp<RootStackParamList>;

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paidBy: string;
  splitWith: string[];
}

type AddExpenseParams = {
  addNewExpense: (expense: Expense) => void;
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();

  // Get state and functions from context
  const { expenses, deleteExpense, addNewExpense } = useExpenses();

  // Navigate to Add Expense screen - Pass the context's addNewExpense function
  const handleAddExpenseNavigation = () => {
    navigation.navigate('add-expense' as never);
  };

  // Create dynamic styles that use theme colors
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
    },
    scrollViewContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textDark,
      marginBottom: 12,
    },
    seeAllText: {
      color: colors.primaryColor,
      fontWeight: '600',
    },
    actionText: {
      fontSize: 14,
      color: colors.textDark,
      marginTop: 4,
      textAlign: 'center',
    },
    expenseCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      // Using boxShadow instead of individual shadow properties
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    expenseContent: {
      flex: 1,
      marginRight: 10,
    },
    expenseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    expenseTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textDark,
      flex: 1,
      marginRight: 8,
    },
    expenseAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primaryColor,
    },
    expenseDetails: {
      paddingTop: 4,
    },
    expenseDate: {
      fontSize: 14,
      color: colors.textMedium,
      marginBottom: 4,
    },
    expensePaidBy: {
      fontSize: 14,
      color: colors.textMedium,
      marginBottom: 4,
    },
    expenseSplitWith: {
      fontSize: 14,
      color: colors.textMedium,
    },
    deleteButton: {
      padding: 8,
      marginLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickActions: {
      marginBottom: 24,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
    },
    actionButton: {
      alignItems: 'center',
      maxWidth: 80,
    },
    actionIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    recentExpenses: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    listContainer: {
      paddingBottom: 16,
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <View style={{ flex: 1 }}>
        {/* Quick Actions - Fixed header */}
        <View style={dynamicStyles.quickActions}>
          <Text style={dynamicStyles.sectionTitle}>Quick Actions</Text>
          <View style={dynamicStyles.actionButtons}>
            <TouchableOpacity
              style={dynamicStyles.actionButton}
              onPress={handleAddExpenseNavigation}
            >
              <View style={[dynamicStyles.actionIcon, { backgroundColor: colors.primaryColor }]}>
                <Ionicons name="add-outline" size={24} color="#fff" />
              </View>
              <Text style={dynamicStyles.actionText}>Add Expense</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => navigation.navigate('newGroup' as never)}>
              <View style={[dynamicStyles.actionIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="people-outline" size={24} color="#fff" />
              </View>
              <Text style={dynamicStyles.actionText}>New Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => router.push('/settle-up')}>
              <View style={[dynamicStyles.actionIcon, { backgroundColor: '#008000' }]}>
                <Ionicons name="cash-outline" size={24} color="#FFFF" />
              </View>
              <Text style={dynamicStyles.actionText}>Settle Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Expenses */}
        <View style={dynamicStyles.recentExpenses}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Recent Expenses</Text>
            <TouchableOpacity onPress={() => alert('Navigate to All Expenses')}>
              <Text style={dynamicStyles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {expenses.length === 0 ? (
            <Text style={{ color: colors.textMedium, textAlign: 'center', marginTop: 20 }}>No expenses added yet.</Text>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={dynamicStyles.expenseCard}>
                  <TouchableOpacity style={dynamicStyles.expenseContent} activeOpacity={0.7} onPress={() => alert(`View details for ${item.title}`)}>
                    <View style={dynamicStyles.expenseHeader}>
                      <Text style={dynamicStyles.expenseTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
                      <Text style={dynamicStyles.expenseAmount}>${item.amount.toFixed(2)}</Text>
                    </View>
                    <View style={dynamicStyles.expenseDetails}>
                      <Text style={dynamicStyles.expenseDate}>Date: {item.date}</Text>
                      <Text style={dynamicStyles.expensePaidBy}>Paid by: {item.paidBy}</Text>
                      {item.splitWith.length > 0 && (
                        <Text style={dynamicStyles.expenseSplitWith} numberOfLines={1} ellipsizeMode="tail">
                          Split with: {item.splitWith.join(', ')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={dynamicStyles.deleteButton}
                    onPress={async () => {
                      try {
                        await deleteExpense(item.id);
                      } catch (error: any) {
                        alert(`Error deleting expense: ${error.message || 'Unknown error'}`);
                      }
                    }}
                  >
                    <Ionicons name="trash-outline" size={24} color={colors.dangerColor || '#FF3B30'} />
                  </TouchableOpacity>
                </View>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={dynamicStyles.listContainer}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

//add check to make sure userers cannot add themselves to groups 