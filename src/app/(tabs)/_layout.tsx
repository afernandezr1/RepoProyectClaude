import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Text, type ColorValue } from 'react-native';
import { useTheme } from '../../components/theme';
import { useApp } from '../../state/AppContext';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const { settings } = useApp();
  const t = useTheme();
  if (!settings.disclaimerAcknowledged) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('☰') }} />
      <Tabs.Screen name="trends" options={{ title: 'Patterns', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="logs" options={{ title: 'Logs', tabBarIcon: icon('✎') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
