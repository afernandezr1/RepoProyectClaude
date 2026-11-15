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
      <Button testID="new-template" title="+ Nueva plantilla" onPress={() => router.push('/templates/new')} />
      {state.data.templates.length === 0 ? (
        <EmptyState title="No hay plantillas" body="Crea una con los ejercicios, series y descansos que te gusten." />
      ) : (
        state.data.templates.map((t) => (
          <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Editar ${t.name}`} onPress={() => router.push(`/templates/${t.id}`)}>
            <Card>
              <Body style={{ fontWeight: '600' }}>{t.name}</Body>
              <Muted>{t.exercises.map((e) => `${names.get(e.exerciseId) ?? 'Ejercicio'} ${e.targetSets}×${e.targetReps ?? '–'}`).join(' · ') || 'Sin ejercicios'}</Muted>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
