import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F5F2',
  card: '#FFFFFF',
  text: '#1F2328',
  muted: '#5F6670',
  border: '#DAD7D0',
  primary: '#2F6B5E',
  primaryText: '#FFFFFF',
  danger: '#A13D2D',
  success: '#2E6B3A',
  successBg: '#E3F1E5',
  errorBg: '#F8E4E0',
  infoBg: '#E6EEF2',
  bar: '#8DB3A8',
  barMuted: '#D9E4E0',
};

const dark: typeof light = {
  bg: '#141617',
  card: '#1E2123',
  text: '#ECEDEE',
  muted: '#A0A6AD',
  border: '#33383C',
  primary: '#7FBFAE',
  primaryText: '#0F1A17',
  danger: '#F09A8A',
  success: '#8FD19E',
  successBg: '#1D3323',
  errorBg: '#3A211C',
  infoBg: '#1D2A31',
  bar: '#6FA698',
  barMuted: '#2C3633',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 10;
