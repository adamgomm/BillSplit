import { Platform, Linking } from 'react-native';

interface PaymentInfo {
  type: 'cashapp' | 'venmo';
  username: string;
  amount?: number;
  note?: string;
}

export const handlePaymentRedirect = async (paymentInfo: PaymentInfo) => {
  const { type, username, amount, note } = paymentInfo;
  
  // Remove any special characters from username except @ and $
  const cleanUsername = username.replace(/[^a-zA-Z0-9@$]/g, '');
  
  if (Platform.OS === 'web') {
    // Web URLs
    const urls = {
      cashapp: `https://cash.app/${cleanUsername}${amount ? `/${amount}` : ''}`,
      venmo: `https://venmo.com/${cleanUsername.replace('@', '')}${amount ? `?txn=pay&amount=${amount}` : ''}`
    };

    // For web, open in new tab
    window.open(urls[type], '_blank');
  } else {
    // Mobile deep links
    const schemes = {
      cashapp: `cashapp://cash.app/${cleanUsername}${amount ? `/${amount}` : ''}`,
      venmo: `venmo://paycharge?txn=pay&recipients=${cleanUsername.replace('@', '')}${amount ? `&amount=${amount}` : ''}${note ? `&note=${encodeURIComponent(note)}` : ''}`
    };

    try {
      const canOpen = await Linking.canOpenURL(schemes[type]);
      if (canOpen) {
        await Linking.openURL(schemes[type]);
      } else {
        // Fallback to web URLs if app isn't installed
        const webUrls = {
          cashapp: `https://cash.app/${cleanUsername}${amount ? `/${amount}` : ''}`,
          venmo: `https://venmo.com/${cleanUsername.replace('@', '')}${amount ? `?txn=pay&amount=${amount}` : ''}`
        };
        await Linking.openURL(webUrls[type]);
      }
    } catch (error) {
      console.error('Error opening payment app:', error);
      // Handle error (show alert, etc.)
    }
  }
}; 