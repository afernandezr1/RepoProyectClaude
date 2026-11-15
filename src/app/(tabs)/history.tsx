import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../components/states';
import { Body, Card, Muted, Screen } from '../../components/ui';
import { formatDateTime, minutesBetween } from '../../domain/dates';
import { fmt } from '../../domain/units';
import { useLoad } from '../../state/AppContext';

export default function History() {
  const { state, retry } = useLoad((s) => s.listHistory());

  if (state.status === 'loading') return <LoadingState label="Cargando historial…" />;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  if (state.data.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Aún no has registrado entrenamientos"
          body="Los entrenamientos terminados aparecen aquí. Todo se guarda solo en este dispositivo."
          actionLabel="Empezar uno"
          onAction={() => router.navigate('/')}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      {state.data.map(({ workout, completedSets, exerciseCount }) => (
        <Pressable
          key={workout.id}
          accessibilityRole="button"
          accessibilityLabel={`${workout.name}, ${formatDateTime(workout.startedAt)}`}
          onPress={() => router.push(`/history/${workout.id}`)}
        >
          <Card>
            <Body style={{ fontWeight: '600' }}>{workout.name}</Body>
            <Muted>{formatDateTime(workout.startedAt)}</Muted>
            <Muted>
              {fmt(minutesBetween(workout.startedAt, workout.endedAt), 0)} min · {exerciseCount} ejercicios · {completedSets} series
            </Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
