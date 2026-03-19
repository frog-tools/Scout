import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#e9236f',
    secondary: '#dfeaee',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#fc868c',
    secondary: '#52575c',
  },
};

export const frogLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2e7d32',
    secondary: '#c8e6c9',
    primaryContainer: '#a5d6a7',
    secondaryContainer: '#e8f5e9',
    background: '#e8f5e9',
    surface: '#f1f8e9',
    surfaceVariant: '#c8e6c9',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: '#e8f5e9',
      level1: '#dcedc8',
      level2: '#c5e1a5',
      level3: '#aed581',
      level4: '#9ccc65',
      level5: '#8bc34a',
    },
  },
};

export const frogDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#66bb6a',
    secondary: '#2e4830',
    primaryContainer: '#1b5e20',
    secondaryContainer: '#1b3d1e',
    background: '#0a1f0c',
    surface: '#112214',
    surfaceVariant: '#1e3620',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: '#0a1f0c',
      level1: '#112214',
      level2: '#1a3a1c',
      level3: '#1e4620',
      level4: '#225224',
      level5: '#265e28',
    },
  },
};
