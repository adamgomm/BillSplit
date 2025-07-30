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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';

export default function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<'cashapp' | 'venmo'>('cashapp');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [currentPayment, setCurrentPayment] = useState<string | null>(null);

  // Initialize Supabase client
  useEffect(() => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    setSupabase(client);
  }, []);

  // Load current payment info
  useEffect(() => {
    loadPaymentInfo();
  }, [supabase]);

  const loadPaymentInfo = async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('Payment')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setCurrentPayment(data?.Payment || null);
      
      // Set the type based on the username prefix
      if (data?.Payment) {
        setSelectedType(data.Payment.startsWith('$') ? 'cashapp' : 'venmo');
      }
    } catch (error) {
      console.error('Error loading payment info:', error);
      Alert.alert('Error', 'Failed to load payment information');
    }
  };

  const savePaymentMethod = async () => {
    console.log('[PaymentMethodsScreen] Attempting to save payment method:', {
      type: selectedType,
      username: username
    });

    if (!supabase) {
      console.error('[PaymentMethodsScreen] Supabase client not initialized');
      Alert.alert('Error', 'Connection not ready');
      return;
    }

    if (!username.trim()) {
      console.log('[PaymentMethodsScreen] Username is empty');
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    // Validate username format
    if (selectedType === 'cashapp' && !username.startsWith('$')) {
      console.log('[PaymentMethodsScreen] Invalid Cash App username format');
      Alert.alert('Error', 'Cash App usernames must start with $');
      return;
    }

    if (selectedType === 'venmo' && !username.startsWith('@')) {
      console.log('[PaymentMethodsScreen] Invalid Venmo username format');
      Alert.alert('Error', 'Venmo usernames must start with @');
      return;
    }

    setLoading(true);

    try {
      console.log('[PaymentMethodsScreen] Getting current user');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[PaymentMethodsScreen] No authenticated user found');
        throw new Error('Not authenticated');
      }

      console.log('[PaymentMethodsScreen] Updating profile with payment:', username.trim());
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ Payment: username.trim() })
        .eq('id', user.id);

      if (updateError) {
        console.error('[PaymentMethodsScreen] Update error:', updateError);
        throw updateError;
      }

      console.log('[PaymentMethodsScreen] Payment method saved successfully');
      setCurrentPayment(username.trim());
      setModalVisible(false);
      Alert.alert('Success', 'Payment information updated');
    } catch (error) {
      console.error('[PaymentMethodsScreen] Error saving payment info:', error);
      Alert.alert('Error', 'Failed to save payment information');
    } finally {
      setLoading(false);
    }
  };

  const removePaymentMethod = async () => {
    if (!supabase || !currentPayment) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ Payment: null })
        .eq('id', user.id);

      if (error) throw error;

      setCurrentPayment(null);
      Alert.alert('Success', 'Payment information removed');
    } catch (error) {
      console.error('Error removing payment info:', error);
      Alert.alert('Error', 'Failed to remove payment information');
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove your payment information?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: removePaymentMethod }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Payment Method</Text>
          
          {currentPayment ? (
            <View style={styles.paymentMethodCard}>
              <View style={[
                styles.paymentMethodIcon,
                currentPayment.startsWith('$') ? styles.cashAppIcon : styles.venmoIcon
              ]}>
                <Ionicons
                  name={currentPayment.startsWith('$') ? 'cash' : 'card'}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.paymentMethodInfo}>
                <Text style={styles.paymentMethodName}>
                  {currentPayment.startsWith('$') ? 'Cash App' : 'Venmo'}
                </Text>
                <Text style={styles.paymentMethodUsername}>
                  {currentPayment}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemove}
              >
                <Ionicons name="trash-outline" size={20} color={colors.dangerColor} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={colors.textMedium} />
              <Text style={[styles.emptyStateText, { color: colors.textMedium }]}>
                No payment method added yet.{'\n'}
                Add Cash App or Venmo to get started.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primaryColor }]}
            onPress={() => {
              if (currentPayment) {
                setUsername(currentPayment);
                setSelectedType(currentPayment.startsWith('$') ? 'cashapp' : 'venmo');
              } else {
                setUsername('');
              }
              setModalVisible(true);
            }}
          >
            <Text style={styles.addButtonText}>
              {currentPayment ? 'Edit Payment Method' : '+ Add Payment Method'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {Platform.OS === 'web' ? (
        // Web-specific modal implementation with proper accessibility
        modalVisible && (
          <View 
            style={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
          >
            <View 
              style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}
              tabIndex={-1}
            >
              <View style={styles.modalHeader}>
                <Text 
                  style={[styles.modalTitle, { color: colors.textDark }]}
                  role="heading"
                  aria-level={2}
                >
                  {currentPayment ? 'Edit Payment Method' : 'Add Payment Method'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    setUsername('');
                  }}
                  aria-label="Close modal"
                >
                  <Ionicons name="close" size={24} color={colors.textDark} />
                </TouchableOpacity>
              </View>

              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    selectedType === 'cashapp' && styles.typeOptionSelected,
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedType('cashapp')}
                  role="radio"
                  aria-checked={selectedType === 'cashapp'}
                >
                  <View style={styles.cashAppIcon}>
                    <Ionicons name="cash" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.typeOptionText, { color: colors.textDark }]}>Cash App</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    selectedType === 'venmo' && styles.typeOptionSelected,
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedType('venmo')}
                  role="radio"
                  aria-checked={selectedType === 'venmo'}
                >
                  <View style={styles.venmoIcon}>
                    <Ionicons name="card" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.typeOptionText, { color: colors.textDark }]}>Venmo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text 
                  style={[styles.inputLabel, { color: colors.textDark }]}
                  nativeID="payment-username-label"
                >
                  {selectedType === 'cashapp' ? 'Cash App Username' : 'Venmo Username'}
                </Text>
                <TextInput
                  style={[styles.textInput, { 
                    backgroundColor: colors.background,
                    color: colors.textDark,
                    borderColor: colors.border
                  }]}
                  placeholder={selectedType === 'cashapp' ? '$username' : '@username'}
                  value={username}
                  onChangeText={setUsername}
                  placeholderTextColor={colors.textMedium}
                  autoCapitalize="none"
                  aria-labelledby="payment-username-label"
                  accessibilityRole="textbox"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    setUsername('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.saveButton,
                    loading && { opacity: 0.7 }
                  ]}
                  onPress={savePaymentMethod}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={loading ? "Saving..." : "Save"}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                    {loading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )
      ) : (
        // Native modal implementation
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.modalTitle, { color: colors.textDark }]}>
                {currentPayment ? 'Edit Payment Method' : 'Add Payment Method'}
              </Text>

              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    selectedType === 'cashapp' && styles.typeOptionSelected,
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedType('cashapp')}
                >
                  <View style={styles.cashAppIcon}>
                    <Ionicons name="cash" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.typeOptionText, { color: colors.textDark }]}>Cash App</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    selectedType === 'venmo' && styles.typeOptionSelected,
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedType('venmo')}
                >
                  <View style={styles.venmoIcon}>
                    <Ionicons name="card" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.typeOptionText, { color: colors.textDark }]}>Venmo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.textDark }]}>
                  {selectedType === 'cashapp' ? 'Cash App Username' : 'Venmo Username'}
                </Text>
                <TextInput
                  style={[styles.textInput, { 
                    backgroundColor: colors.background,
                    color: colors.textDark,
                    borderColor: colors.border
                  }]}
                  placeholder={selectedType === 'cashapp' ? '$username' : '@username'}
                  value={username}
                  onChangeText={setUsername}
                  placeholderTextColor={colors.textMedium}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('[PaymentMethodsScreen] Cancel button pressed');
                    setModalVisible(false);
                    setUsername('');
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.saveButton,
                    loading && { opacity: 0.7 }
                  ]}
                  onPress={() => {
                    console.log('[PaymentMethodsScreen] Save button pressed');
                    savePaymentMethod();
                  }}
                  disabled={loading}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                    {loading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 12,
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
    color: '#333',
    marginBottom: 2,
  },
  paymentMethodUsername: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
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
    textAlign: 'center',
    marginTop: 12,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
  },
  typeOptionSelected: {
    borderColor: '#5D3FD3',
    backgroundColor: '#5D3FD320',
  },
  typeOptionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    backgroundColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#5D3FD3',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButtonText: {
    color: '#FFFFFF',
  },
}); 