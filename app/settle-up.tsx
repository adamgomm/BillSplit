import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useExpenses } from '../contexts/ExpenseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handlePaymentRedirect } from '../lib/paymentUtils';
import supabaseClient from '../lib/supabaseClient';

interface PaymentMethod {
  id: string;
  type: 'cashapp' | 'venmo';
  username: string;
  displayName: string;
}

interface FriendBalance {
  name: string;
  amount: number; // Positive: they owe you, Negative: you owe them
}

export default function SettleUpScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { expenses } = useExpenses();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendBalance | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [settledBalances, setSettledBalances] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPaymentMethods();
    loadSettledBalances();
  }, []);

  // Reload payment methods when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadPaymentMethods();
      loadSettledBalances();
    }, [])
  );

  const loadPaymentMethods = async () => {
    try {
      // Check if we have a session
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (sessionError) {
        console.error("[SettleUpScreen] Session error:", sessionError);
        throw new Error('Session error');
      }

      if (!session) {
        console.error("[SettleUpScreen] No active session");
        router.replace('/login');
        return;
      }

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not found');

      const { data, error } = await supabaseClient
        .from('profiles')
        .select('Payment')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      // Convert the single payment string to PaymentMethod array format
      if (data?.Payment) {
        const paymentString = data.Payment;
        const isVenmo = paymentString.startsWith('@');
        const isCashApp = paymentString.startsWith('$');
        
        if (isVenmo || isCashApp) {
          const paymentMethod: PaymentMethod = {
            id: '1', // Single payment method, so we can use a fixed ID
            type: isCashApp ? 'cashapp' : 'venmo',
            username: paymentString,
            displayName: isCashApp ? 'Cash App' : 'Venmo'
          };
          setPaymentMethods([paymentMethod]);
        }
      } else {
        setPaymentMethods([]);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
      if (error.message?.includes('auth') || error.message?.includes('session')) {
        Alert.alert('Session Expired', 'Please log in again.');
        router.replace('/login');
      } else {
        // If we can't load from database, fallback to empty array
        setPaymentMethods([]);
      }
    }
  };

  const loadSettledBalances = async () => {
    try {
      const stored = await AsyncStorage.getItem('settledBalances');
      if (stored) {
        setSettledBalances(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Error loading settled balances:', error);
    }
  };

  const saveSettledBalances = async (newSettledBalances: Set<string>) => {
    try {
      await AsyncStorage.setItem('settledBalances', JSON.stringify(Array.from(newSettledBalances)));
    } catch (error) {
      console.error('Error saving settled balances:', error);
    }
  };

  const markAsSettled = (friendName: string) => {
    Alert.alert(
      'Mark as Settled',
      `Mark balance with ${friendName} as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Settled',
          onPress: () => {
            const newSettledBalances = new Set(settledBalances);
            newSettledBalances.add(friendName);
            setSettledBalances(newSettledBalances);
            saveSettledBalances(newSettledBalances);
          },
        },
      ]
    );
  };

  const unmarkAsSettled = (friendName: string) => {
    const newSettledBalances = new Set(settledBalances);
    newSettledBalances.delete(friendName);
    setSettledBalances(newSettledBalances);
    saveSettledBalances(newSettledBalances);
  };

  // Calculate friend balances (reusing logic from dashboard)
  const friendBalances = useMemo(() => {
    const balances: FriendBalance[] = [];
    const friendDebts: Record<string, number> = {};
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

    const friends = Array.from(participants);
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
      }
    });

    Object.entries(friendDebts).forEach(([name, amount]) => {
      if (Math.abs(amount) > 0.01) {
        balances.push({ name, amount });
      }
    });

    return balances.sort((a, b) => a.name.localeCompare(b.name));
  }, [expenses]);

  // Filter out settled balances for display
  const activeBalances = friendBalances.filter(balance => !settledBalances.has(balance.name));
  const settledBalancesList = friendBalances.filter(balance => settledBalances.has(balance.name));

  const handleSelectFriend = (friend: FriendBalance) => {
    setSelectedFriend(friend);
    if (paymentMethods.length === 0) {
      Alert.alert(
        'No Payment Methods',
        'Please add a payment method first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Payment Method', 
            onPress: () => router.push('/payment-methods') 
          },
        ]
      );
      return;
    }
    setModalVisible(true);
  };

  const generatePaymentLink = (friend: FriendBalance, paymentMethod: PaymentMethod) => {
    const amount = Math.abs(friend.amount);
    const isOwedToYou = friend.amount > 0;
    
    let baseUrl = '';
    let note = '';

    if (paymentMethod.type === 'cashapp') {
      baseUrl = 'https://cash.app/';
      if (isOwedToYou) {
        // They owe you - request money
        note = encodeURIComponent(`Payment for shared expenses - ${friend.name} owes you`);
        return `${baseUrl}${paymentMethod.username.substring(1)}/${amount}?note=${note}`;
      } else {
        // You owe them - send money
        note = encodeURIComponent(`Payment for shared expenses - You owe ${friend.name}`);
        return `${baseUrl}${paymentMethod.username.substring(1)}/${amount}?note=${note}`;
      }
    } else if (paymentMethod.type === 'venmo') {
      baseUrl = 'https://venmo.com/';
      if (isOwedToYou) {
        // They owe you - request money
        note = encodeURIComponent(`Payment for shared expenses - ${friend.name} owes you`);
        return `${baseUrl}${paymentMethod.username.substring(1)}?txn=charge&amount=${amount}&note=${note}`;
      } else {
        // You owe them - send money
        note = encodeURIComponent(`Payment for shared expenses - You owe ${friend.name}`);
        return `${baseUrl}${paymentMethod.username.substring(1)}?txn=pay&amount=${amount}&note=${note}`;
      }
    }

    return '';
  };

  const handlePayment = async (friend: FriendBalance, paymentMethod: PaymentMethod) => {
    const isOwedToYou = friend.amount > 0;
    const amount = Math.abs(friend.amount);
    const actionText = isOwedToYou ? 'request payment from' : 'send payment to';
    const methodName = paymentMethod.type === 'cashapp' ? 'Cash App' : 'Venmo';
    
    Alert.alert(
      'Confirm Payment',
      `${actionText} ${friend.name} for $${amount.toFixed(2)} using ${methodName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              await handlePaymentRedirect({
                type: paymentMethod.type,
                username: paymentMethod.username,
                amount: amount,
                note: `Payment for shared expenses - ${isOwedToYou ? `${friend.name} owes you` : `You owe ${friend.name}`}`
              });
              
              setModalVisible(false);
              
              // Show success message
              setTimeout(() => {
                Alert.alert(
                  'Payment Initiated',
                  `${methodName} should now be open with the payment details pre-filled.`,
                  [{ text: 'OK' }]
                );
              }, 1000);
            } catch (error) {
              console.error('Error opening payment app:', error);
              Alert.alert('Error', 'Could not open payment app. Please try again.');
            }
          },
        },
      ]
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: colors.shadowColor || '#000',
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
    balanceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    avatarText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    friendInfo: {
      flex: 1,
    },
    friendName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textDark,
      marginBottom: 4,
    },
    balanceDescription: {
      fontSize: 14,
      color: colors.textMedium,
      marginBottom: 2,
    },
    balanceAmount: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    positiveAmount: {
      color: colors.successColor || '#34C759',
    },
    negativeAmount: {
      color: colors.dangerColor || '#FF3B30',
    },
    buttonContainer: {
      flexDirection: 'column',
    },
    settleButton: {
      backgroundColor: colors.primaryColor,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
      minWidth: 80,
      marginBottom: 8,
    },
    markSettledButton: {
      backgroundColor: colors.successColor || '#34C759',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
      minWidth: 80,
    },
    settleButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
    },
    emptyStateText: {
      fontSize: 16,
      color: colors.textMedium,
      textAlign: 'center',
      marginTop: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 24,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textDark,
      marginBottom: 8,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 16,
      color: colors.textMedium,
      textAlign: 'center',
      marginBottom: 24,
    },
    paymentMethodOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentMethodIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    cashAppIcon: {
      backgroundColor: '#00C853',
    },
    venmoIcon: {
      backgroundColor: '#3D95CE',
    },
    paymentMethodInfo: {
      flex: 1,
    },
    paymentMethodName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textDark,
      marginBottom: 2,
    },
    paymentMethodUsername: {
      fontSize: 14,
      color: colors.textMedium,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    cancelButton: {
      backgroundColor: colors.border,
    },
    cancelButtonText: {
      color: colors.textDark,
      fontSize: 16,
      fontWeight: '600',
    },
    noPaymentMethods: {
      alignItems: 'center',
      padding: 20,
    },
    noPaymentMethodsText: {
      fontSize: 16,
      color: colors.textMedium,
      textAlign: 'center',
      marginBottom: 16,
    },
    addPaymentMethodButton: {
      backgroundColor: colors.primaryColor,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    addPaymentMethodText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.content}>
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Outstanding Balances</Text>
          
          {activeBalances.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.successColor} />
              <Text style={dynamicStyles.emptyStateText}>
                All balances are settled!{'\n'}
                No outstanding amounts with friends.
              </Text>
            </View>
          ) : (
            activeBalances.map((friend, index) => {
              const isOwedToYou = friend.amount > 0;
              const avatarBgColor = isOwedToYou 
                ? colors.successLight || 'rgba(52, 199, 89, 0.2)' 
                : colors.dangerLight || 'rgba(255, 59, 48, 0.2)';
              
              return (
                <View key={friend.name} style={dynamicStyles.balanceCard}>
                  <View style={[dynamicStyles.avatarCircle, { backgroundColor: avatarBgColor }]}>
                    <Text style={[
                      dynamicStyles.avatarText, 
                      { color: isOwedToYou ? colors.successColor : colors.dangerColor }
                    ]}>
                      {friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  
                  <View style={dynamicStyles.friendInfo}>
                    <Text style={dynamicStyles.friendName}>{friend.name}</Text>
                    <Text style={[
                      dynamicStyles.balanceDescription,
                      isOwedToYou ? dynamicStyles.positiveAmount : dynamicStyles.negativeAmount
                    ]}>
                      {isOwedToYou ? `${friend.name} owes you` : `You owe ${friend.name}`}
                    </Text>
                    <Text style={[
                      dynamicStyles.balanceAmount,
                      isOwedToYou ? dynamicStyles.positiveAmount : dynamicStyles.negativeAmount
                    ]}>
                      ${Math.abs(friend.amount).toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={dynamicStyles.buttonContainer}>
                    <TouchableOpacity
                      style={dynamicStyles.settleButton}
                      onPress={() => handleSelectFriend(friend)}
                    >
                      <Text style={dynamicStyles.settleButtonText}>
                        {isOwedToYou ? 'Request' : 'Pay'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={dynamicStyles.markSettledButton}
                      onPress={() => markAsSettled(friend.name)}
                    >
                      <Text style={dynamicStyles.settleButtonText}>
                        Mark Settled
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Settled Balances</Text>
          {settledBalancesList.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.successColor} />
              <Text style={dynamicStyles.emptyStateText}>
                No settled balances.{'\n'}
                Outstanding balances will appear here once marked as settled.
              </Text>
            </View>
          ) : (
            <>
              {settledBalancesList.map((friend, index) => {
                const isOwedToYou = friend.amount > 0;
                const avatarBgColor = isOwedToYou 
                  ? colors.successLight || 'rgba(52, 199, 89, 0.2)' 
                  : colors.dangerLight || 'rgba(255, 59, 48, 0.2)';
                
                return (
                  <View key={friend.name} style={dynamicStyles.balanceCard}>
                    <View style={[dynamicStyles.avatarCircle, { backgroundColor: avatarBgColor }]}>
                      <Text style={[
                        dynamicStyles.avatarText, 
                        { color: isOwedToYou ? colors.successColor : colors.dangerColor }
                      ]}>
                        {friend.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={dynamicStyles.friendInfo}>
                      <Text style={dynamicStyles.friendName}>{friend.name}</Text>
                      <Text style={[
                        dynamicStyles.balanceDescription,
                        isOwedToYou ? dynamicStyles.positiveAmount : dynamicStyles.negativeAmount
                      ]}>
                        {isOwedToYou ? `${friend.name} owed you` : `You owed ${friend.name}`}
                      </Text>
                      <Text style={[
                        dynamicStyles.balanceAmount,
                        isOwedToYou ? dynamicStyles.positiveAmount : dynamicStyles.negativeAmount
                      ]}>
                        ${Math.abs(friend.amount).toFixed(2)} (Settled)
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      style={[dynamicStyles.settleButton, { backgroundColor: colors.textMedium }]}
                      onPress={() => unmarkAsSettled(friend.name)}
                    >
                      <Text style={dynamicStyles.settleButtonText}>
                        Unmark
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              
              {settledBalancesList.length > 0 && (
                <TouchableOpacity
                  style={[dynamicStyles.markSettledButton, { backgroundColor: colors.dangerColor, marginTop: 16 }]}
                  onPress={() => {
                    Alert.alert(
                      'Clear All Settled Balances',
                      'Remove all settled balances from the list?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear All',
                          style: 'destructive',
                          onPress: () => {
                            setSettledBalances(new Set());
                            saveSettledBalances(new Set());
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={dynamicStyles.settleButtonText}>
                    Clear All Settled
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContainer}>
            {selectedFriend && (
              <>
                <Text style={dynamicStyles.modalTitle}>
                  {selectedFriend.amount > 0 ? 'Request Payment' : 'Send Payment'}
                </Text>
                <Text style={dynamicStyles.modalSubtitle}>
                  ${Math.abs(selectedFriend.amount).toFixed(2)} {selectedFriend.amount > 0 ? 'from' : 'to'} {selectedFriend.name}
                </Text>

                {paymentMethods.length === 0 ? (
                  <View style={dynamicStyles.noPaymentMethods}>
                    <Text style={dynamicStyles.noPaymentMethodsText}>
                      No payment methods available.{'\n'}
                      Add Cash App or Venmo to continue.
                    </Text>
                    <TouchableOpacity
                      style={dynamicStyles.addPaymentMethodButton}
                      onPress={() => {
                        setModalVisible(false);
                        router.push('/payment-methods');
                      }}
                    >
                      <Text style={dynamicStyles.addPaymentMethodText}>
                        Add Payment Method
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={[dynamicStyles.sectionTitle, { marginBottom: 12 }]}>
                      Choose Payment Method
                    </Text>
                    
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        style={dynamicStyles.paymentMethodOption}
                        onPress={() => handlePayment(selectedFriend, method)}
                      >
                        <View
                          style={[
                            dynamicStyles.paymentMethodIcon,
                            method.type === 'cashapp'
                              ? dynamicStyles.cashAppIcon
                              : dynamicStyles.venmoIcon,
                          ]}
                        >
                          <Ionicons
                            name={method.type === 'cashapp' ? 'cash' : 'card'}
                            size={20}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={dynamicStyles.paymentMethodInfo}>
                          <Text style={dynamicStyles.paymentMethodName}>
                            {method.displayName}
                          </Text>
                          <Text style={dynamicStyles.paymentMethodUsername}>
                            {method.type === 'cashapp' ? 'Cash App' : 'Venmo'}: {method.username}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMedium} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                <View style={dynamicStyles.modalButtons}>
                  <TouchableOpacity
                    style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
} 