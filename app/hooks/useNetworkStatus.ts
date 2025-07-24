import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        setIsConnected(!!state.isConnected);
      });

      return () => unsubscribe();
    }
  }, []);

  return isConnected;
} 