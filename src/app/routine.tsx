import React, { useState } from 'react';
import { Banner, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../components/states';
import { Body, Button, Card, Muted, Row, Screen, Segmented } from '../components/ui';
import { WEEKDAY_LONG } from '../domain/dates';
import { routineSuggestions } from '../domain/routine';
import type { DayPlanKind, RoutineDay } from '../domain/types';
import { useApp, useLoad } from '../state/AppContext';

export default function Routine() {
  const { store, bump } = useApp();
  const { state, retry } = useLoad(async (s) => ({ routine: await s.getRoutine(), templates: await s.listTemplates() }));
  const [msg, setMsg] = useState<BannerMessage | null>(null);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  const { routine, templates } = state.data;

  const save = async (day: RoutineDay) => {
    try {
      await store.saveRoutineDay(day);
      bump();
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't save: ${errorMessage(e)}` });
    }
  };

  return (
    <Screen>
      <Muted>
        Plan a moderate week that fits your life. Nothing here is enforced — the plan is a guide, and changing it any time is
        normal.
      </Muted>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      {routineSuggestions(routine).map((s) => (
        <Muted key={s}>{s}</Muted>
      ))}
      {routine.map((d) => (
        <Card key={d.weekday}>
          <Body style={{ fontWeight: '600' }}>{WEEKDAY_LONG[d.weekday]}</Body>
          <Segmented<DayPlanKind>
            value={d.kind}
            onChange={(kind) => save({ ...d, kind, templateId: kind === 'workout' ? d.templateId : null })}
            options={[
              { value: 'workout', label: 'Workout' },
              { value: 'rest', label: 'Rest' },
              { value: 'open', label: 'Open' },
            ]}
          />
          {d.kind === 'workout' && templates.length > 0 ? (
            <Row>
              <Muted>Template:</Muted>
              <Button
                small
                kind={d.templateId === null ? 'primary' : 'secondary'}
                title="Any"
                onPress={() => save({ ...d, templateId: null })}
              />
              {templates.map((t) => (
                <Button
                  key={t.id}
                  small
                  kind={d.templateId === t.id ? 'primary' : 'secondary'}
                  title={t.name}
                  onPress={() => save({ ...d, templateId: t.id })}
                />
              ))}
            </Row>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
