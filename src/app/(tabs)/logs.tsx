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
    if (!(await confirm('¿Eliminar la entrada?', describe(l) || LOG_KIND_LABEL[l.kind], 'Eliminar', true))) return;
    try {
      await store.deleteLog(l.id);
      bump();
      setMsg({ kind: 'success', text: 'Entrada eliminada.' });
    } catch (e) {
      setMsg({ kind: 'error', text: `No se pudo eliminar: ${errorMessage(e)}` });
    }
  };

  const header = (
    <>
      <Muted>Todos los registros son opcionales. Apunta solo lo que te resulte útil.</Muted>
      <Button testID="add-log" title="+ Nueva entrada" onPress={() => router.push('/log-new')} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todo' },
          { value: 'activity', label: 'Actividad' },
          { value: 'sleep', label: 'Sueño' },
          { value: 'mood', label: 'Ánimo' },
          { value: 'energy', label: 'Energía' },
          { value: 'note', label: 'Notas' },
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
          title={filter === 'all' ? 'Aún no hay entradas' : `No hay entradas de ${LOG_KIND_LABEL[filter].toLowerCase()}`}
          body="Aquí puedes registrar actividad, sueño, ánimo, energía y notas personales cuando quieras."
        />
      ) : (
        items.map((l) => (
          <Card key={l.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '600' }}>
                {LOG_KIND_LABEL[l.kind]}
                {l.source === 'health' ? ' · importado' : ''}
              </Body>
              <Button small kind="ghost" title="Eliminar" onPress={() => remove(l)} accessibilityLabel={`Eliminar entrada de ${LOG_KIND_LABEL[l.kind]}`} />
            </Row>
            {describe(l) ? <Body>{describe(l)}</Body> : null}
            <Muted>{formatDateTime(l.loggedAt)}</Muted>
          </Card>
        ))
      )}
    </Screen>
  );
}
