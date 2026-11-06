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

  if (state.status === 'loading') return <LoadingState label="Loading history…" />;
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
          title="No workouts logged yet"
          body="Finished workouts appear here. Everything is stored only on this device."
          actionLabel="Start one"
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
              {fmt(minutesBetween(workout.startedAt, workout.endedAt), 0)} min · {exerciseCount} exercises · {completedSets} sets
            </Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
