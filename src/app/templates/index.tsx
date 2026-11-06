import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../components/states';
import { Body, Button, Card, Muted, Screen } from '../../components/ui';
import { useLoad } from '../../state/AppContext';

export default function Templates() {
  const { state, retry } = useLoad(async (s) => ({ templates: await s.listTemplates(), exercises: await s.listExercises() }));
  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  const names = new Map(state.data.exercises.map((e) => [e.id, e.name]));
  return (
    <Screen>
      <Button testID="new-template" title="+ New template" onPress={() => router.push('/templates/new')} />
      {state.data.templates.length === 0 ? (
        <EmptyState title="No templates" body="Create one with the exercises, sets and rest times you like." />
      ) : (
        state.data.templates.map((t) => (
          <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Edit ${t.name}`} onPress={() => router.push(`/templates/${t.id}`)}>
            <Card>
              <Body style={{ fontWeight: '600' }}>{t.name}</Body>
              <Muted>{t.exercises.map((e) => `${names.get(e.exerciseId) ?? 'Exercise'} ${e.targetSets}×${e.targetReps ?? '–'}`).join(' · ') || 'No exercises'}</Muted>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
