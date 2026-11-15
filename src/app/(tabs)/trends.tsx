import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Bars } from '../../components/Bars';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../components/states';
import { Body, Card, H2, Muted, Screen, Segmented } from '../../components/ui';
import { WEEKDAY_SHORT } from '../../domain/dates';
import { computeTrends } from '../../domain/trends';
import { fmt, unitLabel } from '../../domain/units';
import { useApp, useLoad } from '../../state/AppContext';

type Range = '4' | '8' | '12';

export default function Trends() {
  const { settings } = useApp();
  const [range, setRange] = useState<Range>('8');
  const { state, retry } = useLoad(async (s) => ({
    workouts: await s.listAllWorkouts(),
    sets: await s.listAllSets(),
    logs: await s.listLogs(5000),
    routine: await s.getRoutine(),
    exercises: await s.listExercises(),
  }));

  const trends = useMemo(() => {
    if (state.status !== 'ready') return null;
    return computeTrends({ ...state.data, settings, now: new Date(), weeks: Number(range) });
  }, [state, settings, range]);

  if (state.status === 'loading' || (!trends && state.status !== 'error')) return <LoadingState label="Revisando tus semanas…" />;
  if (state.status === 'error' || !trends) {
    return (
      <Screen>
        <ErrorState message={state.status === 'error' ? errorMessage(state.error) : 'Error desconocido'} onRetry={retry} />
      </Screen>
    );
  }

  const rangeControl = (
    <Segmented
      label="Mostrar"
      value={range}
      onChange={setRange}
      options={[
        { value: '4', label: '4 semanas' },
        { value: '8', label: '8 semanas' },
        { value: '12', label: '12 semanas' },
      ]}
    />
  );

  if (trends.isEmpty) {
    return (
      <Screen>
        {rangeControl}
        <EmptyState
          title="Aún no hay nada que mostrar"
          body="Los patrones aparecen cuando registras un entrenamiento o una entrada. Aquí no hay objetivos, solo una imagen de tus semanas."
          actionLabel="Añadir una entrada"
          onAction={() => router.push('/log-new')}
        />
      </Screen>
    );
  }

  const weeks = trends.weeks;
  const hasSleep = weeks.some((w) => w.sleepAverage != null);
  const hasMood = weeks.some((w) => w.moodAverage != null);
  const hasEnergy = weeks.some((w) => w.energyAverage != null);
  const hasActivity = weeks.some((w) => w.activityTotal > 0);

  return (
    <Screen>
      {rangeControl}
      <Card>
        {trends.observations.map((o) => (
          <Body key={o}>{o}</Body>
        ))}
      </Card>

      <Card>
        <H2>Días activos por semana</H2>
        <Muted>Días con un entrenamiento o una actividad registrada.</Muted>
        <Bars label="Días activos por semana" data={weeks.map((w) => ({ label: w.label, value: w.activeDays }))} />
      </Card>

      <Card>
        <H2>Sesiones por día de la semana</H2>
        <Bars
          label="Sesiones por día de la semana"
          data={trends.weekdayPattern.map((p) => ({ label: WEEKDAY_SHORT[p.weekday], value: p.sessions }))}
        />
      </Card>

      <Card>
        <H2>Volumen de entrenamiento</H2>
        <Muted>Peso × repeticiones de las series completadas, en {unitLabel(settings.weightUnit)}.</Muted>
        <Bars
          label="Volumen de entrenamiento por semana"
          format={(v) => (v >= 1000 ? `${fmt(v / 1000)}k` : fmt(v, 0))}
          data={weeks.map((w) => ({ label: w.label, value: w.volume }))}
        />
      </Card>

      {hasActivity ? (
        <Card>
          <H2>Actividad registrada</H2>
          <Bars
            label={`Actividad registrada por semana en ${settings.activityUnit}`}
            format={(v) => fmt(v)}
            data={weeks.map((w) => ({ label: w.label, value: w.activityTotal }))}
          />
          <Muted>Total por semana, en {unitLabel(settings.activityUnit)}.</Muted>
        </Card>
      ) : null}

      {hasSleep ? (
        <Card>
          <H2>Sueño</H2>
          <Bars
            label="Sueño medio registrado por semana"
            format={(v) => fmt(v)}
            data={weeks.map((w) => ({ label: w.label, value: w.sleepAverage }))}
          />
          <Muted>Media por entrada, en {unitLabel(settings.sleepUnit)}.</Muted>
        </Card>
      ) : null}

      {hasMood || hasEnergy ? (
        <Card>
          <H2>Ánimo y energía</H2>
          {hasMood ? (
            <>
              <Muted>Ánimo, media {unitLabel(settings.moodScale)}</Muted>
              <Bars label="Ánimo medio por semana" format={(v) => fmt(v)} data={weeks.map((w) => ({ label: w.label, value: w.moodAverage }))} />
            </>
          ) : null}
          {hasEnergy ? (
            <>
              <Muted>Energía, media {unitLabel(settings.energyScale)}</Muted>
              <Bars label="Energía media por semana" format={(v) => fmt(v)} data={weeks.map((w) => ({ label: w.label, value: w.energyAverage }))} />
            </>
          ) : null}
          <Muted>Solo un registro de cómo te sentiste. Los altibajos son normales.</Muted>
        </Card>
      ) : null}

      {trends.exerciseTrends.slice(0, 4).map((e) => (
        <Card key={e.exerciseId}>
          <H2>{e.name}</H2>
          {e.points.some((p) => p.topWeight != null) ? (
            <>
              <Muted>Serie completada más pesada por semana, en {unitLabel(settings.weightUnit)}</Muted>
              <Bars label={`${e.name}, serie más pesada por semana`} format={(v) => fmt(v)} data={e.points.map((p) => ({ label: `${p.weekStart.slice(8)}/${p.weekStart.slice(5, 7)}`, value: p.topWeight }))} />
            </>
          ) : (
            <>
              <Muted>Repeticiones totales por semana</Muted>
              <Bars label={`${e.name}, repeticiones por semana`} data={e.points.map((p) => ({ label: `${p.weekStart.slice(8)}/${p.weekStart.slice(5, 7)}`, value: p.totalReps }))} />
            </>
          )}
        </Card>
      ))}
      <Muted>Los patrones describen lo que registraste. No miden tu salud ni el avance hacia ningún objetivo.</Muted>
    </Screen>
  );
}
