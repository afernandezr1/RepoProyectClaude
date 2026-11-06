import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState, LoadingState, errorMessage } from '../components/states';
import { useTheme } from '../components/theme';
import { AppProvider, useBoot } from '../state/AppContext';

export default function RootLayout() {
  const { boot, retry } = useBoot();
  const t = useTheme();

  if (boot.status !== 'ready') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16, justifyContent: 'center' }}>
          {boot.status === 'loading' ? (
            <LoadingState label="Opening your local data…" />
          ) : (
            <ErrorState
              message={`The local database could not be opened: ${errorMessage(boot.error)}`}
              onRetry={retry}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider store={boot.store} initialSettings={boot.settings} dbPath={boot.dbPath}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.card },
            headerTintColor: t.text,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ title: 'Welcome', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="history/[id]" options={{ title: 'Workout details' }} />
          <Stack.Screen name="templates/index" options={{ title: 'Templates' }} />
          <Stack.Screen name="templates/[id]" options={{ title: 'Edit template' }} />
          <Stack.Screen name="routine" options={{ title: 'Weekly routine' }} />
          <Stack.Screen name="log-new" options={{ title: 'New log entry', presentation: 'modal' }} />
          <Stack.Screen name="reminders" options={{ title: 'Reminders' }} />
          <Stack.Screen name="data" options={{ title: 'Your data' }} />
          <Stack.Screen name="about" options={{ title: 'About & safety' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
