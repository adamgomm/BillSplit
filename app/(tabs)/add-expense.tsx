import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useLocalSearchParams, router } from 'expo-router';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useTheme } from '../../contexts/ThemeContext';

// You'll need to install these packages if not already:
// npm install @react-native-community/datetimepicker

interface Friend {
  id: string;
  name: string;
  selected: boolean;
}

// Define the Expense type (ensure it matches context definition)
interface ExpenseInput {
  title: string;
  amount: number;
  date: string;
  paidBy: string;
  splitWith: string[];
}

export default function AddExpenseScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const { addNewExpense } = useExpenses();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidBy, setPaidBy] = useState('You');
  const [friends, setFriends] = useState<Friend[]>([
    { id: 'you', name: 'You', selected: false },
  ]);
  const [saving, setSaving] = useState(false);

  // Get route parameters
  const params = useLocalSearchParams<{ members?: string }>();

  // Effect to update friends when params.members changes
  useEffect(() => {
    if (params.members) {
      console.log(`[AddExpenseScreen] Received members param: ${params.members}`);
      try {
        const incomingMemberNames: string[] = JSON.parse(params.members);
        console.log(`[AddExpenseScreen] Parsed incomingMemberNames: ${JSON.stringify(incomingMemberNames)}`);

        setFriends(currentFriends => {
          console.log(`[AddExpenseScreen] Current friends state: ${JSON.stringify(currentFriends)}`);
          const currentFriendNames = currentFriends.map(f => f.name);
          
          // Filter out names that are already in the list (case-sensitive)
          const uniqueNewMemberNames = incomingMemberNames.filter(
            name => !currentFriendNames.includes(name)
          );
          console.log(`[AddExpenseScreen] Unique new names to add: ${JSON.stringify(uniqueNewMemberNames)}`);

          if (uniqueNewMemberNames.length === 0) {
            console.log('[AddExpenseScreen] No unique new members to add.');
            return currentFriends; // No changes needed
          }

          // Map unique new names to Friend objects
          const uniqueNewFriends: Friend[] = uniqueNewMemberNames.map(name => ({ 
            id: name, // Use name as ID for simplicity
            name: name, 
            selected: false 
          }));

          const updatedFriends = [...currentFriends, ...uniqueNewFriends];
          console.log(`[AddExpenseScreen] Updating friends state with: ${JSON.stringify(updatedFriends)}`);
          return updatedFriends;
        });

        // Clear the parameter so this effect doesn't re-run with the same data
        console.log('[AddExpenseScreen] Clearing members param.');
        router.setParams({ members: undefined });

      } catch (e) {
        console.error('[AddExpenseScreen] Failed to parse or process members param:', e);
        Alert.alert('Error', 'Could not load group members passed from previous screen.');
        // Clear potentially faulty param
        router.setParams({ members: undefined }); 
      }
    } else {
        console.log('[AddExpenseScreen] No members param received.');
    }
  }, [params.members]); // Rerun effect if params.members changes

  const onDateChange = (event: any, selectedDate?: Date) => {
    // Always hide the picker after any interaction on mobile platforms
    if (Platform.OS !== 'web') {
      setShowDatePicker(false);
    }

    // Only update the state if a valid date was selected
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const toggleFriendSelection = (id: string) => {
    setFriends(friends.map(friend => 
      friend.id === id ? { ...friend, selected: !friend.selected } : friend
    ));
  };

  const getSelectedFriends = () => {
    return friends.filter(friend => friend.selected).map(friend => friend.name);
  };

  const saveExpense = async () => {
    console.log("[AddExpenseScreen] Save button pressed. Validating input...");

    const parsedAmount = parseFloat(amount);
    if (!title.trim() || !amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid title and positive amount.');
      console.log("[AddExpenseScreen] Validation failed: Title or amount issue.");
      return;
    }

    const finalSplitWith = getSelectedFriends();
    if (finalSplitWith.length === 0) {
      Alert.alert('Invalid Split', 'Please select at least one person (including potentially "You") to split the expense with.');
      console.log("[AddExpenseScreen] Validation failed: No one selected for split.");
      return;
    }
    console.log("[AddExpenseScreen] Validation passed.");

    const newExpenseData = { 
      title: title.trim(),
      amount: parsedAmount,
      date: date.toISOString().split('T')[0],
      paidBy,
      splitWith: finalSplitWith,
    };

    console.log("[AddExpenseScreen] newExpenseData prepared:", newExpenseData);

    try {
      setSaving(true);
      console.log("[AddExpenseScreen] Attempting to call addNewExpense from context...");
      await addNewExpense(newExpenseData); 
      console.log("[AddExpenseScreen] addNewExpense from context was called successfully.");

      // Reset form
      setTitle('');
      setAmount('');
      setDate(new Date());
      setPaidBy('You');
      setFriends(prevFriends =>
          prevFriends.map(friend => ({ ...friend, selected: false }))
      );

      Alert.alert('Success', 'Expense added successfully!');

      if (navigation.canGoBack()) {
          navigation.goBack();
      } else {
          navigation.navigate('(tabs)' as never);
      }
    } catch (e: any) {
      console.error('[AddExpenseScreen] Error calling addNewExpense:', e);
      Alert.alert('Error', e.message || 'An error occurred while saving the expense.');
    } finally {
      setSaving(false);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderColor,
      backgroundColor: colors.cardBackground,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textDark,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primaryColor,
    },
    closeButton: {
      padding: 4,
    },
    formContainer: {
      padding: 20,
    },
    inputContainer: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMedium,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.cardBackground,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
      color: colors.textDark,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderColor,
      paddingHorizontal: 14,
    },
    currencySymbol: {
      fontSize: 18,
      color: colors.textMedium,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 18,
      color: colors.textDark,
      fontWeight: '500',
    },
    datePickerButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    datePickerText: {
      fontSize: 16,
      color: colors.textDark,
    },
    paidByContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    paidByOption: {
      backgroundColor: colors.cardBackground,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    paidByOptionSelected: {
      backgroundColor: colors.primaryColor,
      borderColor: colors.primaryColor,
    },
    paidByOptionText: {
      color: colors.textDark,
      fontWeight: '500',
    },
    paidByOptionTextSelected: {
      color: '#FFFFFF',
    },
    friendsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    friendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    friendItemSelected: {
      backgroundColor: colors.primaryColor,
      borderColor: colors.primaryColor,
    },
    friendName: {
      color: colors.textDark,
      fontWeight: '500',
      marginRight: 6,
    },
    friendNameSelected: {
      color: '#FFFFFF',
    },
    checkIcon: {
      marginLeft: 'auto',
    }
  });

  return (
    <ScrollView style={dynamicStyles.container} keyboardShouldPersistTaps="handled">
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.closeButton}>
          <Ionicons name="close-outline" size={28} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Add Expense</Text>
        <TouchableOpacity 
          onPress={saveExpense} 
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryColor} />
          ) : (
            <Text style={dynamicStyles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.formContainer}>
        <View style={dynamicStyles.inputContainer}>
          <Text style={dynamicStyles.inputLabel}>Title</Text>
          <TextInput
            style={dynamicStyles.input}
            placeholder="What was this expense for?"
            placeholderTextColor={colors.textLight || "#999"}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={dynamicStyles.inputContainer}>
          <Text style={dynamicStyles.inputLabel}>Amount</Text>
          <View style={dynamicStyles.amountInputContainer}>
            <Text style={dynamicStyles.currencySymbol}>$</Text>
            <TextInput
              style={dynamicStyles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textLight || "#999"}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        <View style={dynamicStyles.inputContainer}>
          <Text style={dynamicStyles.inputLabel}>Date</Text>
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              style={dynamicStyles.datePickerButton}
            >
              <input
                type="date"
                value={date.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setDate(newDate);
                  }
                }}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: colors.textDark,
                  fontSize: 16,
                  width: '100%',
                  padding: 12,
                  cursor: 'pointer',
                }}
              />
              <Ionicons name="calendar-outline" size={20} color={colors.textMedium} />
            </TouchableOpacity>
          ) : Platform.OS === 'ios' ? (
            <>
              <TouchableOpacity
                style={dynamicStyles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={dynamicStyles.datePickerText}>{date.toLocaleDateString()}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.textMedium} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                />
              )}
            </>
          ) : (
            <>
              <TouchableOpacity
                style={dynamicStyles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={dynamicStyles.datePickerText}>{date.toLocaleDateString()}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.textMedium} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  minimumDate={new Date(2000, 0, 1)}
                  maximumDate={new Date(2050, 11, 31)}
                />
              )}
            </>
          )}
        </View>

        <View style={dynamicStyles.inputContainer}>
          <Text style={dynamicStyles.inputLabel}>Paid By</Text>
          <View style={dynamicStyles.paidByContainer}>
            {friends.map(friend => (
              <TouchableOpacity
                key={friend.id}
                style={[
                  dynamicStyles.paidByOption,
                  paidBy === friend.name && dynamicStyles.paidByOptionSelected
                ]}
                onPress={() => setPaidBy(friend.name)}
              >
                <Text style={[
                  dynamicStyles.paidByOptionText,
                  paidBy === friend.name && dynamicStyles.paidByOptionTextSelected
                ]}>{friend.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={dynamicStyles.inputContainer}>
          <Text style={dynamicStyles.inputLabel}>Split With (Select all involved)</Text>
          <View style={dynamicStyles.friendsList}>
            {friends.map(friend => (
              <TouchableOpacity
                key={friend.id}
                style={[
                  dynamicStyles.friendItem,
                  friend.selected && dynamicStyles.friendItemSelected
                ]}
                onPress={() => toggleFriendSelection(friend.id)}
              >
                <Text style={[
                  dynamicStyles.friendName,
                  friend.selected && dynamicStyles.friendNameSelected
                ]}>{friend.name}</Text>
                {friend.selected && (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" style={dynamicStyles.checkIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}