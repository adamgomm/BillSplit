import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import supabaseClient from '../../lib/supabaseClient';
import { useExpenses } from '../../contexts/ExpenseContext';

export default function ProfileScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const { clearAllExpenses } = useExpenses();

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      const storedUsername = await AsyncStorage.getItem('username');
      console.log('[ProfileScreen] Email loaded from AsyncStorage:', email);
      console.log('[ProfileScreen] Username loaded from AsyncStorage:', storedUsername);
      setEmail(email);
      setUsername(storedUsername);
    } catch (error) {
      console.error('[ProfileScreen] Error loading user info:', error);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('[ProfileScreen] Starting logout process...');
      
      // First, sign out from Supabase
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      // Clear all AsyncStorage
      console.log('[ProfileScreen] Clearing AsyncStorage...');
      await AsyncStorage.clear();
      console.log('[ProfileScreen] AsyncStorage cleared completely.');

      // Clear expenses from context
      console.log('[ProfileScreen] Clearing expense context...');
      clearAllExpenses();

      // Reset Supabase client's internal state
      console.log('[ProfileScreen] Resetting Supabase client...');
      await supabaseClient.auth.initialize();

      // Navigate to login
      console.log('[ProfileScreen] Navigating to login...');
      router.replace('/login');
    } catch (error) {
      console.error('[ProfileScreen] Error during logout:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout',
          style: 'destructive',
          onPress: handleLogout
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          <Text style={styles.profileInitial}>
            {username ? username.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : 'U')}
          </Text>
        </View>
        <Text style={styles.userName}>{username || 'User Profile'}</Text>
        <Text style={styles.userEmail}>{email || 'user@example.com'}</Text>
      </View>

      {/* Settings Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity 
          style={styles.settingRow}
          onPress={() => router.push('/edit-profile')}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="person-outline" size={20} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Edit Profile</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={16} color="#999" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/payment-methods')}>
          <View style={styles.settingInfo}>
            <Ionicons name="card-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Payment Methods</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="key-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Change Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Notifications</Text>
          </View>
          <View style={styles.settingValue}>
            <Text style={styles.settingValueText}>Enabled</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="moon-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Dark Mode</Text>
          </View>
          <View style={styles.settingValue}>
            <Text style={styles.settingValueText}>Enabled</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </View>
        
        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="globe-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Currency</Text>
          </View>
          <View style={styles.settingValue}>
            <Text style={styles.settingValueText}>USD ($)</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        
        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="help-circle-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>Help Center</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="information-circle-outline" size={24} color="#5D3FD3" />
            <Text style={styles.settingLabel}>About App</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
      
      <Text style={styles.versionText}>Version 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#5D3FD3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
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
    color: '#333',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: 16,
    color: '#999',
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
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
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginLeft: 8,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
    marginBottom: 30,
  },
}); 