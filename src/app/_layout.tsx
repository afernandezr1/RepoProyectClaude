import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmHost } from '../components/ConfirmHost';
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
            <LoadingState label="Abriendo tus datos locales…" />
          ) : (
            <ErrorState
              message={`No se pudo abrir la base de datos local: ${errorMessage(boot.error)}`}
              onRetry={retry}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider store={boot.store} initialSettings={boot.settings} dbPath={boot.dbPath} persistent={boot.persistent}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.card },
            headerTintColor: t.text,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ title: 'Bienvenida', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Entrenamiento' }} />
          <Stack.Screen name="history/[id]" options={{ title: 'Detalle del entrenamiento' }} />
          <Stack.Screen name="templates/index" options={{ title: 'Plantillas' }} />
          <Stack.Screen name="templates/[id]" options={{ title: 'Editar plantilla' }} />
          <Stack.Screen name="routine" options={{ title: 'Rutina semanal' }} />
          <Stack.Screen name="log-new" options={{ title: 'Nueva entrada', presentation: 'modal' }} />
          <Stack.Screen name="reminders" options={{ title: 'Recordatorios' }} />
          <Stack.Screen name="data" options={{ title: 'Tus datos' }} />
          <Stack.Screen name="about" options={{ title: 'Información y seguridad' }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        <ConfirmHost />
      </AppProvider>
    </SafeAreaProvider>
  );
}
