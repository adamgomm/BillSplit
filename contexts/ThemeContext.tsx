import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import Colors from '../constants/Colors';

// Create the theme context
export const ThemeContext = createContext({
  colors: Colors.light,
  colorScheme: 'light',
});

// Theme provider component
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ThemeContext.Provider value={{ colors, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook for accessing theme colors
export function useTheme() {
  return useContext(ThemeContext);
} 