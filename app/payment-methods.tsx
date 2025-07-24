import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PaymentMethod {
  id: string;
  type: 'cashapp' | 'venmo';
  username: string;
  displayName: string;
}

export default function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<'cashapp' | 'venmo'>('cashapp');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

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

  const savePaymentMethods = async (methods: PaymentMethod[]) => {
    try {
      await AsyncStorage.setItem('paymentMethods', JSON.stringify(methods));
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error saving payment methods:', error);
      Alert.alert('Error', 'Failed to save payment method');
    }
  };

  const addPaymentMethod = async () => {
    if (!username.trim() || !displayName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate username format
    if (selectedType === 'cashapp' && !username.startsWith('$')) {
      Alert.alert('Error', 'Cash App usernames must start with $');
      return;
    }

    if (selectedType === 'venmo' && !username.startsWith('@')) {
      Alert.alert('Error', 'Venmo usernames must start with @');
      return;
    }

    const newMethod: PaymentMethod = {
      id: Date.now().toString(),
      type: selectedType,
      username: username.trim(),
      displayName: displayName.trim(),
    };

    const updatedMethods = [...paymentMethods, newMethod];
    await savePaymentMethods(updatedMethods);

    setModalVisible(false);
    setUsername('');
    setDisplayName('');
  };

  const removePaymentMethod = (id: string) => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedMethods = paymentMethods.filter(method => method.id !== id);
            await savePaymentMethods(updatedMethods);
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
    paymentMethodCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      marginBottom: 8,
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
    removeButton: {
      padding: 8,
    },
    addButton: {
      backgroundColor: colors.primaryColor,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
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
      marginBottom: 20,
      textAlign: 'center',
    },
    typeSelector: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    typeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 4,
      borderWidth: 2,
      borderColor: colors.border,
    },
    typeOptionSelected: {
      borderColor: colors.primaryColor,
      backgroundColor: colors.primaryColor + '20',
    },
    typeOptionText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textDark,
    },
    inputContainer: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textDark,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textDark,
      backgroundColor: colors.background,
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
    saveButton: {
      backgroundColor: colors.primaryColor,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.textDark,
    },
    saveButtonText: {
      color: '#FFFFFF',
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          style={dynamicStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Payment Methods</Text>
      </View>

      <ScrollView style={dynamicStyles.content}>
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Connected Accounts</Text>
          
          {paymentMethods.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <Ionicons name="card-outline" size={48} color={colors.textMedium} />
              <Text style={dynamicStyles.emptyStateText}>
                No payment methods added yet.{'\n'}
                Add Cash App or Venmo to get started.
              </Text>
            </View>
          ) : (
            paymentMethods.map((method) => (
              <View key={method.id} style={dynamicStyles.paymentMethodCard}>
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
                <TouchableOpacity
                  style={dynamicStyles.removeButton}
                  onPress={() => removePaymentMethod(method.id)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.dangerColor} />
                </TouchableOpacity>
              </View>
            ))
          )}

          <TouchableOpacity
            style={dynamicStyles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={dynamicStyles.addButtonText}>+ Add Payment Method</Text>
          </TouchableOpacity>
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
            <Text style={dynamicStyles.modalTitle}>Add Payment Method</Text>

            <View style={dynamicStyles.typeSelector}>
              <TouchableOpacity
                style={[
                  dynamicStyles.typeOption,
                  selectedType === 'cashapp' && dynamicStyles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType('cashapp')}
              >
                <View style={dynamicStyles.cashAppIcon}>
                  <Ionicons name="cash" size={16} color="#FFFFFF" />
                </View>
                <Text style={dynamicStyles.typeOptionText}>Cash App</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  dynamicStyles.typeOption,
                  selectedType === 'venmo' && dynamicStyles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType('venmo')}
              >
                <View style={dynamicStyles.venmoIcon}>
                  <Ionicons name="card" size={16} color="#FFFFFF" />
                </View>
                <Text style={dynamicStyles.typeOptionText}>Venmo</Text>
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.inputLabel}>Display Name</Text>
              <TextInput
                style={dynamicStyles.textInput}
                placeholder="e.g., John's Cash App"
                value={displayName}
                onChangeText={setDisplayName}
                placeholderTextColor={colors.textMedium}
              />
            </View>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.inputLabel}>
                {selectedType === 'cashapp' ? 'Cash App Username' : 'Venmo Username'}
              </Text>
              <TextInput
                style={dynamicStyles.textInput}
                placeholder={selectedType === 'cashapp' ? '$username' : '@username'}
                value={username}
                onChangeText={setUsername}
                placeholderTextColor={colors.textMedium}
                autoCapitalize="none"
              />
            </View>

            <View style={dynamicStyles.modalButtons}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setUsername('');
                  setDisplayName('');
                }}
              >
                <Text style={[dynamicStyles.modalButtonText, dynamicStyles.cancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[dynamicStyles.modalButton, dynamicStyles.saveButton]}
                onPress={addPaymentMethod}
              >
                <Text style={[dynamicStyles.modalButtonText, dynamicStyles.saveButtonText]}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
} 