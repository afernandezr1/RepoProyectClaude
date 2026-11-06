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

  if (state.status === 'loading' || (!trends && state.status !== 'error')) return <LoadingState label="Looking at your weeks…" />;
  if (state.status === 'error' || !trends) {
    return (
      <Screen>
        <ErrorState message={state.status === 'error' ? errorMessage(state.error) : 'Unknown error'} onRetry={retry} />
      </Screen>
    );
  }

  const rangeControl = (
    <Segmented
      label="Show"
      value={range}
      onChange={setRange}
      options={[
        { value: '4', label: '4 weeks' },
        { value: '8', label: '8 weeks' },
        { value: '12', label: '12 weeks' },
      ]}
    />
  );

  if (trends.isEmpty) {
    return (
      <Screen>
        {rangeControl}
        <EmptyState
          title="Nothing to show yet"
          body="Patterns appear once you log a workout or an entry. There are no targets here — just a picture of your weeks."
          actionLabel="Add a log entry"
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
        <H2>Active days per week</H2>
        <Muted>Days with a workout or a logged activity.</Muted>
        <Bars label="Active days per week" data={weeks.map((w) => ({ label: w.label, value: w.activeDays }))} />
      </Card>

      <Card>
        <H2>Sessions by weekday</H2>
        <Bars
          label="Sessions by weekday"
          data={trends.weekdayPattern.map((p) => ({ label: WEEKDAY_SHORT[p.weekday], value: p.sessions }))}
        />
      </Card>

      <Card>
        <H2>Training volume</H2>
        <Muted>Weight × reps of completed sets, in {unitLabel(settings.weightUnit)}.</Muted>
        <Bars
          label="Training volume per week"
          format={(v) => (v >= 1000 ? `${fmt(v / 1000)}k` : fmt(v, 0))}
          data={weeks.map((w) => ({ label: w.label, value: w.volume }))}
        />
      </Card>

      {hasActivity ? (
        <Card>
          <H2>Logged activity</H2>
          <Bars
            label={`Logged activity per week in ${settings.activityUnit}`}
            format={(v) => fmt(v)}
            data={weeks.map((w) => ({ label: w.label, value: w.activityTotal }))}
          />
          <Muted>Total per week, {unitLabel(settings.activityUnit)}.</Muted>
        </Card>
      ) : null}

      {hasSleep ? (
        <Card>
          <H2>Sleep</H2>
          <Bars
            label="Average logged sleep per week"
            format={(v) => fmt(v)}
            data={weeks.map((w) => ({ label: w.label, value: w.sleepAverage }))}
          />
          <Muted>Average per entry, {unitLabel(settings.sleepUnit)}.</Muted>
        </Card>
      ) : null}

      {hasMood || hasEnergy ? (
        <Card>
          <H2>Mood & energy</H2>
          {hasMood ? (
            <>
              <Muted>Mood, average {unitLabel(settings.moodScale)}</Muted>
              <Bars label="Average mood per week" format={(v) => fmt(v)} data={weeks.map((w) => ({ label: w.label, value: w.moodAverage }))} />
            </>
          ) : null}
          {hasEnergy ? (
            <>
              <Muted>Energy, average {unitLabel(settings.energyScale)}</Muted>
              <Bars label="Average energy per week" format={(v) => fmt(v)} data={weeks.map((w) => ({ label: w.label, value: w.energyAverage }))} />
            </>
          ) : null}
          <Muted>Just a record of how you felt — ups and downs are normal.</Muted>
        </Card>
      ) : null}

      {trends.exerciseTrends.slice(0, 4).map((e) => (
        <Card key={e.exerciseId}>
          <H2>{e.name}</H2>
          {e.points.some((p) => p.topWeight != null) ? (
            <>
              <Muted>Heaviest completed set per week, {unitLabel(settings.weightUnit)}</Muted>
              <Bars label={`${e.name}, heaviest set per week`} format={(v) => fmt(v)} data={e.points.map((p) => ({ label: p.weekStart.slice(5), value: p.topWeight }))} />
            </>
          ) : (
            <>
              <Muted>Total reps per week</Muted>
              <Bars label={`${e.name}, reps per week`} data={e.points.map((p) => ({ label: p.weekStart.slice(5), value: p.totalReps }))} />
            </>
          )}
        </Card>
      ))}
      <Muted>Patterns describe what you logged. They aren’t a measure of health or progress toward any target.</Muted>
    </Screen>
  );
}
