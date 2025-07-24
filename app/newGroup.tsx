import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Alert, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, router } from 'expo-router';
import { Stack } from 'expo-router';
import { createClient, SupabaseClient, AuthError, PostgrestError } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';
import { useNetworkStatus } from './hooks/useNetworkStatus';

// Define a type for the user profile data from Supabase
interface UserProfile {
  id: string;
  email: string;
}

interface AuthResponse {
  data: {
    user: {
      email: string | null;
    } | null;
  };
  error: AuthError | null;
}

interface ProfilesResponse {
  data: UserProfile[] | null;
  error: PostgrestError | null;
}

export default function NewGroupScreen() {
  const navigation = useNavigation();
  const isConnected = useNetworkStatus();
  
  // Hide the navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // State for manually added/selected members (stores emails)
  const [members, setMembers] = useState<string[]>(['']);

  // State for Supabase users
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // Initialize Supabase Client
  useEffect(() => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    setSupabase(client);
    console.log('[NewGroupScreen] Supabase client initialized.');
  }, []);

  // Fetch Users with improved error handling
  const fetchUsers = async () => {
    if (!supabase) return;

    if (Platform.OS === 'android' && !isConnected) {
      Alert.alert(
        "Network Error",
        "No internet connection. Please check your network.",
        [{ text: "OK" }]
      );
      setLoading(false);
      return;
    }

    console.log(`[NewGroupScreen] Fetching users on ${Platform.OS}`);
    setLoading(true);
    setError(null);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      const authResponse = await Promise.race([
        supabase.auth.getUser(),
        timeoutPromise
      ]) as AuthResponse;

      if (authResponse.error) throw authResponse.error;
      const user = authResponse.data.user;

      if (user?.email) {
        setCurrentUserEmail(user.email);
        console.log('[NewGroupScreen] Current user:', user.email);
      }

      const profilesResponse = await Promise.race([
        supabase.from('profiles').select('id, email'),
        timeoutPromise
      ]) as ProfilesResponse;

      if (profilesResponse.error) throw profilesResponse.error;

      const users = (profilesResponse.data || []).filter((profile: UserProfile) => 
        profile.email !== user?.email
      );
      console.log(`[NewGroupScreen] Fetched ${users.length} users successfully`);

      setAllUsers(users);
      setFilteredUsers(users);

    } catch (err: any) {
      console.error("[NewGroupScreen] Error:", {
        message: err.message,
        platform: Platform.OS,
        networkState: isConnected ? 'connected' : 'disconnected'
      });

      let errorMessage = "Failed to load users. Please try again.";
      
      if (!isConnected) {
        errorMessage = "No internet connection. Please check your network.";
      } else if (err.message?.includes('timeout')) {
        errorMessage = "Request timed out. Please check your connection and try again.";
      } else if (err.message?.includes('auth')) {
        errorMessage = "Session expired. Please log in again.";
        router.replace('/login');
      }

      Alert.alert("Error", errorMessage);
      setAllUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users when Supabase client is ready
  useEffect(() => {
    if (supabase) {
      fetchUsers();
    }
  }, [supabase]);

  // --- Filter Users Based on Search Query ---
  useEffect(() => {
    if (searchQuery === '') {
      setFilteredUsers(allUsers);
    } else {
      const lowerCaseQuery = searchQuery.toLowerCase();
      setFilteredUsers(
        allUsers.filter(user => 
          user.email?.toLowerCase().includes(lowerCaseQuery) // Filter by email
        )
      );
    }
  }, [searchQuery, allUsers]);

  const addMember = () => {
    setMembers([...members, '']);
  };

  const updateMember = (text: string, index: number) => {
    const newMembers = [...members];
    newMembers[index] = text;
    setMembers(newMembers);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      const newMembers = [...members];
      newMembers.splice(index, 1);
      setMembers(newMembers);
    }
  };

  const addEmptyMemberInput = () => {
    setMembers([...members, '']);
  };

  const addSelectedUser = (email: string) => {
    if (!members.includes(email)) {
      if (members.length === 1 && members[0] === '') {
        setMembers([email]);
      } else {
        setMembers([...members, email]);
      }
    } else {
      Alert.alert("User Already Added", `${email} is already in the group.`);
    }
  };

  const handleCreateGroup = () => {
    console.log('[NewGroupScreen] handleCreateGroup called!');

    // Members state now contains emails
    const validMembersRaw = members.filter(member => member && member.trim() !== ''); // Check for non-empty strings
    const validMembers = [...new Set(validMembersRaw)]; // Ensure unique emails
    
    if (validMembers.length < 1) {
      Alert.alert('Error', 'Please add at least one member to the group');
      return;
    }

    console.log('Processing members (emails):', validMembers);

    try {
      const membersParam = JSON.stringify(validMembers);
      console.log(`Navigating to /add-expense with members: ${membersParam}`);

      router.navigate({ 
        pathname: '/add-expense', 
        params: { members: membersParam } 
      });
      
      setMembers(['']); // Reset state
      setSearchQuery(''); // Reset search

    } catch (e) {
      console.error('Failed to navigate or pass params', e);
      Alert.alert('Error', 'Could not proceed to add expense.');
    }
  };

  const handleCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Show network status on Android */}
        {Platform.OS === 'android' && !isConnected && (
          <View style={styles.networkWarning}>
            <Text style={styles.networkWarningText}>
              No internet connection
            </Text>
          </View>
        )}
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Ionicons name="close-outline" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Group</Text>
          <TouchableOpacity 
            onPress={handleCreateGroup}
            disabled={!supabase || loading}
            style={{ opacity: (!supabase || loading) ? 0.6 : 1 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#5D3FD3" />
            ) : (
              <Text style={styles.saveButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Group Members Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Members</Text>
            <Text style={styles.sectionSubtitle}>Add members by email address</Text>
            
            {members.map((member, index) => (
              <View key={`member-${index}`} style={styles.memberRow}> 
                <TextInput
                  style={styles.memberInput}
                  placeholder={index === 0 && members.length === 1 && member === '' ? "Enter member email" : `Member ${index + 1} email`}
                  placeholderTextColor="#999"
                  value={member}
                  onChangeText={(text) => updateMember(text, index)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {/* Allow removing even the last item if it's not the initial empty one */}
                {(members.length > 1 || (members.length === 1 && member !== '')) && ( 
                  <TouchableOpacity 
                    style={styles.removeButton} 
                    onPress={() => removeMember(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            <TouchableOpacity style={styles.addButton} onPress={addEmptyMemberInput}> 
              <Ionicons name="add-outline" size={20} color="#5D3FD3" />
              <Text style={styles.addButtonText}>Add Another Member</Text>
            </TouchableOpacity>
          </View>

          {/* Search Users Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Existing Users</Text>
            <Text style={styles.sectionSubtitle}>Find and add users from your contacts</Text>
            
            <TouchableOpacity 
              style={styles.showUsersButton} 
              onPress={() => setShowUserDropdown(!showUserDropdown)}
            >
              <View style={styles.showUsersButtonContent}>
                <Ionicons name="people-outline" size={20} color="#5D3FD3" />
                <Text style={styles.showUsersButtonText}>
                  {showUserDropdown ? 'Hide Users' : 'Show Existing Users'}
                </Text>
                <Ionicons 
                  name={showUserDropdown ? "chevron-up-outline" : "chevron-down-outline"} 
                  size={20} 
                  color="#5D3FD3" 
                />
              </View>
            </TouchableOpacity>

            {showUserDropdown && (
              <View style={styles.userDropdownContainer}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by email..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.usersList}>
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#5D3FD3" />
                      <Text style={styles.loadingText}>Loading users...</Text>
                    </View>
                  ) : error ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.usersListHeader}>
                        {searchQuery ? `Search Results (${filteredUsers.length})` : `Available Users (${filteredUsers.length})`}
                      </Text>
                      {filteredUsers.length > 0 ? (
                        <ScrollView 
                          style={styles.usersScrollView}
                          showsVerticalScrollIndicator={false}
                        >
                          {filteredUsers.map((user) => (
                            <TouchableOpacity 
                              key={user.id}
                              style={[
                                styles.userItem,
                                members.includes(user.email) && styles.userItemSelected
                              ]} 
                              onPress={() => {
                                addSelectedUser(user.email);
                                setSearchQuery('');
                              }}
                              disabled={members.includes(user.email)}
                            >
                              <View style={styles.userInfo}>
                                <View style={styles.userAvatar}>
                                  <Text style={styles.userAvatarText}>
                                    {user.email.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <Text style={[
                                  styles.userText,
                                  members.includes(user.email) && styles.userTextSelected
                                ]}>
                                  {user.email}
                                </Text>
                              </View>
                              {members.includes(user.email) ? (
                                 <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                              ) : (
                                 <Ionicons name="add-circle-outline" size={20} color="#5D3FD3" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={styles.emptyContainer}>
                          <Ionicons name="people-outline" size={24} color="#999" />
                          <Text style={styles.emptyText}>
                            {searchQuery ? `No users found matching "${searchQuery}"` : 'No users available'}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}

            {!supabase && !loading && !error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={24} color="#FF3B30" />
                <Text style={styles.errorText}>Connection error. Please try again.</Text>
              </View>
            )}
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Ionicons name="information-circle-outline" size={20} color="#5D3FD3" />
              <Text style={styles.infoText}>
                After creating the group, you'll be able to add expenses and split them among members
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5D3FD3',
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 20,
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  removeButton: {
    marginLeft: 12,
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addButtonText: {
    color: '#5D3FD3',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  showUsersButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  showUsersButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showUsersButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5D3FD3',
    marginHorizontal: 8,
  },
  userDropdownContainer: {
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  usersList: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 300,
    overflow: 'hidden',
  },
  usersListHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  usersScrollView: {
    maxHeight: 250,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  userItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5D3FD3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  userTextSelected: {
    color: '#5D3FD3',
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  emptyContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
  infoSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 30,
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  networkWarning: {
    backgroundColor: '#ff6b6b',
    padding: 8,
    alignItems: 'center',
    width: '100%',
  },
  networkWarningText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});