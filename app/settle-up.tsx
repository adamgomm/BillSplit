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
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useExpenses } from '../contexts/ExpenseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handlePaymentRedirect } from '../lib/paymentUtils';

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
  const navigation = useNavigation();
  const { expenses } = useExpenses();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendBalance | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const stored = await AsyncStorage.getItem('paymentMethods');
      if (stored) {
        setPaymentMethods(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      // If we can't go back, navigate to the home/dashboard
      router.push('/(tabs)');
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textDark,
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
    settleButton: {
      backgroundColor: colors.primaryColor,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
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
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          style={dynamicStyles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Settle Up</Text>
      </View>

      <ScrollView style={dynamicStyles.content}>
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Outstanding Balances</Text>
          
          {friendBalances.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.successColor} />
              <Text style={dynamicStyles.emptyStateText}>
                All balances are settled!{'\n'}
                No outstanding amounts with friends.
              </Text>
            </View>
          ) : (
            friendBalances.map((friend, index) => {
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
                  
                  <TouchableOpacity
                    style={dynamicStyles.settleButton}
                    onPress={() => handleSelectFriend(friend)}
                  >
                    <Text style={dynamicStyles.settleButtonText}>
                      {isOwedToYou ? 'Request' : 'Pay'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
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