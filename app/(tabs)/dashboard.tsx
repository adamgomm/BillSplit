import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { handlePaymentRedirect } from '../../lib/paymentUtils';

// Define structure for calculated balances (can be expanded)
interface FriendBalance {
  name: string;
  amount: number; // Positive: they owe you, Negative: you owe them
}

interface CategorySpending {
    name: string; // Assuming title can be used as category for simplicity
    amount: number;
    color: string; // Assign colors dynamically or based on category mapping
}

// Helper function to get unique participants (excluding 'You')
const getUniqueFriends = (expenses: ReturnType<typeof useExpenses>['expenses']): string[] => {
    const participants = new Set<string>();
    expenses.forEach(expense => {
        if (expense.paidBy !== 'You') {
            participants.add(expense.paidBy);
        }
        expense.splitWith.forEach(person => {
            if (person !== 'You') {
                participants.add(person);
            }
        });
    });
    return Array.from(participants);
};

// Simple color assignment for categories (can be improved)
const categoryColors = ['#5D3FD3', '#FF9500', '#34C759', '#007AFF', '#8E8E93', '#FF3B30', '#AF52DE'];
const getCategoryColor = (index: number) => categoryColors[index % categoryColors.length];

export default function DashboardScreen() {
  const { expenses } = useExpenses(); // Get expenses from context
  const { colors } = useTheme(); // Get theme colors
  const router = useRouter(); // Add router for navigation

  // Calculate summary data using useMemo to avoid recalculating on every render
  const summaryData = useMemo(() => {
    let totalSpent = 0;
    let youPaid = 0;
    let totalYouOwe = 0;
    let totalYouAreOwed = 0;
    const friendDebts: Record<string, number> = {}; // Tracks net amount for each friend (+ means they owe you)

    // Initialize friend debts for all participants
     const friends = getUniqueFriends(expenses);
     friends.forEach(friend => { friendDebts[friend] = 0; });


    expenses.forEach(expense => {
      totalSpent += expense.amount;

      // Your share calculation (assuming equal split for now)
      const numberOfParticipants = expense.splitWith.length;
      if (numberOfParticipants === 0) return; // Avoid division by zero if splitWith is empty

      const share = expense.amount / numberOfParticipants;

      if (expense.paidBy === 'You') {
        youPaid += expense.amount;
        expense.splitWith.forEach(person => {
          if (person !== 'You') {
             friendDebts[person] = (friendDebts[person] || 0) + share; // They owe you their share
          }
        });
      } else {
          // Someone else paid
          const payer = expense.paidBy;
          if (expense.splitWith.includes('You')) {
              // You owe the payer your share
              friendDebts[payer] = (friendDebts[payer] || 0) - share;
          }
          // Adjust debts between other friends if necessary (complex, omitted for simplicity)
          // Example: If Alex paid, and Maria was included, Maria owes Alex.
          // This requires tracking inter-friend debts, often simplified in apps.
      }
    });

    // Calculate totals based on friendDebts
     Object.values(friendDebts).forEach(amount => {
        if (amount > 0) {
            totalYouAreOwed += amount;
        } else {
            totalYouOwe += Math.abs(amount);
        }
     });


    const netBalance = totalYouAreOwed - totalYouOwe;

    return {
      totalSpent,
      youPaid,
      youOwe: totalYouOwe,
      youAreOwed: totalYouAreOwed,
      netBalance,
    };
  }, [expenses]); // Recalculate only when expenses change

  // Calculate friend balances
   const friendBalances = useMemo(() => {
       const balances: FriendBalance[] = [];
       const friendDebts: Record<string, number> = {};
       const friends = getUniqueFriends(expenses);
       friends.forEach(friend => { friendDebts[friend] = 0; });

       expenses.forEach(expense => {
           const numberOfParticipants = expense.splitWith.length;
           if (numberOfParticipants === 0) return;
           const share = expense.amount / numberOfParticipants;

           if (expense.paidBy === 'You') {
               expense.splitWith.forEach(person => {
                   if (person !== 'You') {
                       friendDebts[person] = (friendDebts[person] || 0) + share;
                   }
               });
           } else {
               const payer = expense.paidBy;
               if (expense.splitWith.includes('You')) {
                    friendDebts[payer] = (friendDebts[payer] || 0) - share;
               }
               // Inter-friend debt calculation (simplified)
           }
       });

        Object.entries(friendDebts).forEach(([name, amount]) => {
           if (Math.abs(amount) > 0.01) { // Only show non-zero balances
               balances.push({ name, amount });
           }
       });

       return balances.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
   }, [expenses]);


  // Calculate category spending (simple grouping by title)
   const expenseCategories = useMemo(() => {
       const categories: Record<string, number> = {};
       expenses.forEach(expense => {
           // Use expense title as a proxy for category - needs refinement
           const categoryName = expense.title; // Or implement a real category field
           categories[categoryName] = (categories[categoryName] || 0) + expense.amount;
       });

       return Object.entries(categories)
            .map(([name, amount], index) => ({
                id: name, // Use name as ID for simplicity
                name,
                amount,
                color: getCategoryColor(index), // Assign a color
            }))
            .sort((a, b) => b.amount - a.amount); // Sort by amount descending
   }, [expenses]);


  // Dynamic styles using theme
  const dynamicStyles = StyleSheet.create({
  container: {
    flex: 1,
      backgroundColor: colors.background, // Use theme background
    padding: 16,
  },
  summaryCard: {
      backgroundColor: colors.cardBackground, // Use theme card background
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
      color: colors.textDark, // Use theme text color
    marginBottom: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
      borderBottomColor: colors.borderColor, // Use theme border color
  },
  totalLabel: {
    fontSize: 16,
      color: colors.textMedium, // Use theme text color
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
      color: colors.textDark, // Use theme text color
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
      flex: 1, // Distribute space evenly
  },
  summaryLabel: {
    fontSize: 14,
      color: colors.textMedium,
    marginBottom: 4,
      textAlign: 'center',
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
      color: colors.textDark,
  },
  netBalanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
      borderTopColor: colors.borderColor,
  },
  netBalanceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
      color: colors.textDark,
  },
  netBalanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  positiveAmount: {
      color: colors.successColor || '#34C759', // Use theme success color or default
  },
  owedAmount: {
      color: colors.dangerColor || '#FF3B30', // Use theme danger color or default
  },
  section: {
      backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
      color: colors.textDark,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    minHeight: 72, // Ensure consistent height
  },
     balanceRowLast: { // Style to remove border for the last item
        borderBottomWidth: 0,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.6, // Take 60% of the space
    marginRight: 16, // Increased margin
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
      color: colors.textDark, // Base color, might need contrast adjustment based on bg
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textDark,
    flex: 1, // Allow text to take remaining space
    flexWrap: 'wrap', // Allow wrapping
  },
  balanceInfo: {
    flex: 0.4, // Take 40% of the space
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
    balanceDescription: { // Text like "owes you" or "You owe"
        fontSize: 12,
        color: colors.textMedium,
        marginBottom: 4,
        textAlign: 'right',
        flexWrap: 'wrap', // Allow wrapping
        maxWidth: '100%', // Ensure text stays within container
    },
    balanceAmount: { // The $ amount
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'right',
        // Color set dynamically
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
        flexWrap: 'nowrap', // Ensure items stay in one row
    },
     categoryRowLast: { // Style to remove margin for the last item
        marginBottom: 0,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
        width: '35%', // Allocate space for category name
        marginRight: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
        flexShrink: 0, // Prevent dot from shrinking
  },
  categoryName: {
    fontSize: 14,
        color: colors.textDark,
        flexShrink: 1, // Allow name to shrink if needed
  },
  categoryBarContainer: {
        flex: 1, // Take remaining space
    height: 8,
        backgroundColor: colors.borderColor, // Background for the bar track
    borderRadius: 4,
        marginHorizontal: 8,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 4,
        // Width and background color set dynamically
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '500',
        color: colors.textDark,
        width: 70, // Fixed width for alignment
    textAlign: 'right',
        marginLeft: 8,
  },
  actions: {
      marginTop: 10, // Add some space before actions
    marginBottom: 30,
  },
  settleButton: {
      backgroundColor: colors.primaryColor, // Use theme primary color
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
  },
  settleButtonText: {
      color: '#fff', // Ensure text is readable on button
      fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
    emptyStateText: {
        textAlign: 'center',
        fontSize: 16,
        color: colors.textMedium,
        marginTop: 20,
        marginBottom: 20,
    }
  });

  const handlePaymentClick = (friend: FriendBalance) => {
    // Get the payment method from the friend's profile
    // For now, we'll assume it's stored in the Payment field
    // You might need to fetch this from your profiles table
    const paymentInfo = friend.name.startsWith('$') 
      ? { type: 'cashapp' as const, username: friend.name }
      : { type: 'venmo' as const, username: friend.name };

    // Add the amount they owe
    if (friend.amount !== 0) {
      paymentInfo.amount = Math.abs(friend.amount);
    }

    handlePaymentRedirect(paymentInfo);
  };

  // Check if there are any expenses to display
  if (expenses.length === 0) {
       return (
           <View style={[dynamicStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
               <Ionicons name="document-text-outline" size={64} color={colors.textMedium} />
               <Text style={dynamicStyles.emptyStateText}>No expenses to display.</Text>
                <Text style={{ color: colors.textMedium }}>Add an expense from the Home screen.</Text>
           </View>
       );
   }


  return (
    <ScrollView style={dynamicStyles.container} showsVerticalScrollIndicator={false}>
      {/* Summary Card */}
      <View style={dynamicStyles.summaryCard}>
        <Text style={dynamicStyles.cardTitle}>Expense Summary</Text>

        <View style={dynamicStyles.totalContainer}>
          <Text style={dynamicStyles.totalLabel}>Total Group Expenses</Text>
          <Text style={dynamicStyles.totalAmount}>${summaryData.totalSpent.toFixed(2)}</Text>
        </View>

        <View style={dynamicStyles.summaryRow}>
          <View style={dynamicStyles.summaryItem}>
            <Text style={dynamicStyles.summaryLabel}>You paid</Text>
            <Text style={dynamicStyles.summaryAmount}>${summaryData.youPaid.toFixed(2)}</Text>
          </View>

          <View style={dynamicStyles.summaryItem}>
            <Text style={dynamicStyles.summaryLabel}>You owe</Text>
            <Text style={[dynamicStyles.summaryAmount, dynamicStyles.owedAmount]}>
              ${summaryData.youOwe.toFixed(2)}
            </Text>
          </View>

          <View style={dynamicStyles.summaryItem}>
            <Text style={dynamicStyles.summaryLabel}>You're owed</Text>
            <Text style={[dynamicStyles.summaryAmount, dynamicStyles.positiveAmount]}>
              ${summaryData.youAreOwed.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={dynamicStyles.netBalanceContainer}>
          <Text style={dynamicStyles.netBalanceLabel}>Your Net Balance</Text>
          <Text style={[
            dynamicStyles.netBalanceAmount,
            summaryData.netBalance >= 0 ? dynamicStyles.positiveAmount : dynamicStyles.owedAmount
          ]}>
            {summaryData.netBalance >= 0 ? '+' : '-'}${Math.abs(summaryData.netBalance).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Friend Balances */}
      {friendBalances.length > 0 && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Friend Balances</Text>

            {friendBalances.map((friend, index) => {
                const isOwedToYou = friend.amount > 0;
                const owesYouText = isOwedToYou ? `${friend.name} owes you` : `You owe ${friend.name}`;
                const avatarBgColor = isOwedToYou 
                    ? 'rgba(52, 199, 89, 0.2)' 
                    : 'rgba(255, 59, 48, 0.2)';
                const avatarTextColor = isOwedToYou ? colors.successColor : colors.dangerColor;

                return (
                    <TouchableOpacity
                        key={friend.name} // Use name as key assuming names are unique in this context
                        style={[
                            dynamicStyles.balanceRow,
                            index === friendBalances.length - 1 ? dynamicStyles.balanceRowLast : null, // Remove border on last item
                            Platform.OS === 'web' && { cursor: 'pointer' }
                        ]}
                        onPress={() => handlePaymentClick(friend)}
                    >
                    <View style={dynamicStyles.friendInfo}>
                      <View style={[
                        dynamicStyles.avatarCircle,
                        { backgroundColor: avatarBgColor }
                      ]}>
                        <Text 
                          style={[
                            dynamicStyles.avatarText, 
                            { color: avatarTextColor }
                          ]}
                        >
                          {friend.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text 
                        style={dynamicStyles.friendName}
                        numberOfLines={2} // Allow up to 2 lines for long emails
                        ellipsizeMode="tail" // Add ... if text is too long
                      >
                        {friend.name}
                      </Text>
                    </View>

                    <View style={dynamicStyles.balanceInfo}>
                        <Text 
                          style={[
                            dynamicStyles.balanceDescription,
                             isOwedToYou ? dynamicStyles.positiveAmount : dynamicStyles.owedAmount
                         ]}
                         numberOfLines={2}
                        >
                             {owesYouText}
                         </Text>
                      <Text style={[
                        dynamicStyles.balanceAmount,
                        isOwedToYou ? dynamicStyles.positiveAmount : dynamicStyles.owedAmount
                      ]}>
                        ${Math.abs(friend.amount).toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
            })}
          </View>
      )}
       {/* Show message if no balances */}
       {friendBalances.length === 0 && expenses.length > 0 && (
            <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitle}>Friend Balances</Text>
                <Text style={dynamicStyles.emptyStateText}>No outstanding balances with friends.</Text>
            </View>
       )}


       {/* Expense Categories */}
       {expenseCategories.length > 0 && (
            <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitle}>Spending by Category</Text>

                {expenseCategories.map((category, index) => {
                const percentage = summaryData.totalSpent > 0 ? (category.amount / summaryData.totalSpent) * 100 : 0;

                return (
                    <View
                        key={category.id}
                        style={[
                            dynamicStyles.categoryRow,
                            index === expenseCategories.length - 1 ? dynamicStyles.categoryRowLast : null // Remove margin on last item
                         ]}
                    >
                    <View style={dynamicStyles.categoryInfo}>
                        <View style={[dynamicStyles.categoryDot, { backgroundColor: category.color }]} />
                        <Text style={dynamicStyles.categoryName} numberOfLines={1} ellipsizeMode="tail">{category.name}</Text>
                    </View>

                    <View style={dynamicStyles.categoryBarContainer}>
                        <View
                        style={[
                            dynamicStyles.categoryBar,
                            {
                            width: `${percentage}%`,
                            backgroundColor: category.color
                            }
                        ]}
                        />
                    </View>

                    <Text style={dynamicStyles.categoryAmount}>${category.amount.toFixed(2)}</Text>
                    </View>
                );
                })}
            </View>
       )}


      {/* Settle Up Action */}
       {summaryData.netBalance !== 0 && ( // Only show settle button if there's a balance
         <View style={dynamicStyles.actions}>
           <TouchableOpacity style={dynamicStyles.settleButton} onPress={() => router.push('/settle-up')}>
             <Ionicons name="cash-outline" size={20} color="#fff" />
             <Text style={dynamicStyles.settleButtonText}>Settle Balances</Text>
           </TouchableOpacity>
         </View>
       )}
    </ScrollView>
  );
}

// Static styles can be removed if fully replaced by dynamicStyles
// const styles = StyleSheet.create({ ... }); 