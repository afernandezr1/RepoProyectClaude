import { router } from 'expo-router';
import React, { useState } from 'react';
import { confirm } from '../../components/confirm';
import { Banner, EmptyState, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../../components/states';
import { Body, Button, Card, Muted, Row, Screen, Segmented } from '../../components/ui';
import { LOG_KIND_LABEL } from '../../domain/copy';
import { formatDateTime } from '../../domain/dates';
import type { LogEntry, LogKind } from '../../domain/types';
import { fmt, unitLabel } from '../../domain/units';
import { useApp, useLoad } from '../../state/AppContext';

type Filter = 'all' | LogKind;

function describe(l: LogEntry): string {
  if (l.kind === 'note') return l.text;
  const v = l.value != null ? `${fmt(l.value, 2)} ${unitLabel(l.unit)}` : '';
  return [v, l.text].filter(Boolean).join(' — ');
}

export default function Logs() {
  const { store, bump } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [msg, setMsg] = useState<BannerMessage | null>(null);
  const { state, retry } = useLoad((s) => s.listLogs(1000));

  const remove = async (l: LogEntry) => {
    if (!(await confirm('Delete entry?', describe(l) || LOG_KIND_LABEL[l.kind], 'Delete', true))) return;
    try {
      await store.deleteLog(l.id);
      bump();
      setMsg({ kind: 'success', text: 'Entry deleted.' });
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't delete: ${errorMessage(e)}` });
    }
  };

  const header = (
    <>
      <Muted>All logs are optional. Track only what feels useful.</Muted>
      <Button testID="add-log" title="+ New entry" onPress={() => router.push('/log-new')} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'activity', label: 'Activity' },
          { value: 'sleep', label: 'Sleep' },
          { value: 'mood', label: 'Mood' },
          { value: 'energy', label: 'Energy' },
          { value: 'note', label: 'Notes' },
        ]}
      />
      <Banner message={msg} onDismiss={() => setMsg(null)} />
    </>
  );

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <Screen>
        {header}
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  const items = filter === 'all' ? state.data : state.data.filter((l) => l.kind === filter);
  return (
    <Screen>
      {header}
      {items.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No entries yet' : `No ${LOG_KIND_LABEL[filter].toLowerCase()} entries`}
          body="Activity, sleep, mood, energy and personal notes can be logged here whenever you like."
        />
      ) : (
        items.map((l) => (
          <Card key={l.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '600' }}>
                {LOG_KIND_LABEL[l.kind]}
                {l.source === 'health' ? ' · imported' : ''}
              </Body>
              <Button small kind="ghost" title="Delete" onPress={() => remove(l)} accessibilityLabel={`Delete ${LOG_KIND_LABEL[l.kind]} entry`} />
            </Row>
            {describe(l) ? <Body>{describe(l)}</Body> : null}
            <Muted>{formatDateTime(l.loggedAt)}</Muted>
          </Card>
        ))
      )}
    </Screen>
  );
}
