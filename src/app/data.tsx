import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { confirm } from '../components/confirm';
import { Banner, errorMessage, type BannerMessage } from '../components/states';
import { Body, Button, Card, H2, Muted, Screen } from '../components/ui';
import { buildBackup, logsToCsv, parseBackup, serializeBackup, setsToCsv } from '../domain/backup';
import { PRIVACY_SUMMARY } from '../domain/copy';
import { deleteExportFiles, documentDirectoryUri, pickBackupText, saveAndShare } from '../services/files';
import { cancelAllReminders, syncReminders } from '../services/notifications';
import { useApp } from '../state/AppContext';

type Busy = null | 'json' | 'csv' | 'restore' | 'delete';

export default function DataScreen() {
  const { store, dbPath, persistent, bump, updateSettings } = useApp();
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<BannerMessage | null>(null);

  const exportJson = async () => {
    setBusy('json');
    try {
      const backup = buildBackup(await store.exportAll(), new Date());
      const saved = await saveAndShare('steady-log-backup', 'json', serializeBackup(backup));
      setMsg({
        kind: 'success',
        text: saved.uri
          ? `Guardado ${saved.filename}${saved.shared ? '' : ' en la carpeta de documentos de la app'}.`
          : `Descargado ${saved.filename}.`,
      });
    } catch (e) {
      setMsg({ kind: 'error', text: `Falló la exportación: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const b = buildBackup(await store.exportAll(), new Date());
      const a = await saveAndShare('steady-log-sets', 'csv', setsToCsv(b));
      const l = await saveAndShare('steady-log-logs', 'csv', logsToCsv(b));
      setMsg({ kind: 'success', text: `Guardados ${a.filename} y ${l.filename}.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Falló la exportación: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const text = await pickBackupText();
      if (text == null) return;
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        setMsg({ kind: 'error', text: parsed.error });
        return;
      }
      const b = parsed.value;
      const ok = await confirm(
        '¿Reemplazar todos los datos?',
        `Esta copia del ${b.exportedAt.slice(0, 10)} tiene ${b.workouts.length} entrenamientos y ${b.logs.length} entradas de registro. Reemplazará todo lo que hay ahora en la app.`,
        'Reemplazar',
        true,
      );
      if (!ok) return;
      await store.importAll(b);
      await updateSettings({});
      await syncReminders(b.reminders, b.settings.remindersMuted, { askPermission: false });
      bump();
      setMsg({ kind: 'success', text: 'Copia de seguridad restaurada.' });
    } catch (e) {
      setMsg({ kind: 'error', text: `Falló la restauración y no se cambió nada: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const deleteAll = async () => {
    const first = await confirm(
      '¿Borrar todo?',
      'Se eliminarán para siempre de este dispositivo todos los entrenamientos, plantillas, registros, rutina, recordatorios y ajustes. Quizá quieras exportar antes.',
      'Continuar',
      true,
    );
    if (!first) return;
    const second = await confirm('¿Seguro?', 'Esto no se puede deshacer.', 'Borrar todo', true);
    if (!second) return;
    setBusy('delete');
    try {
      await cancelAllReminders();
      await store.deleteEverything();
      deleteExportFiles();
      await updateSettings({ disclaimerAcknowledged: false });
      bump();
      router.replace('/welcome');
    } catch (e) {
      setMsg({ kind: 'error', text: `Falló el borrado: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const dir = documentDirectoryUri();

  return (
    <Screen>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      {!persistent ? (
        <Banner message={{ kind: 'error', text: 'Este navegador bloquea el almacenamiento. Los datos se perderán al cerrar la página; exporta antes de salir.' }} onDismiss={() => undefined} />
      ) : null}
      <Body>{PRIVACY_SUMMARY}</Body>

      <Card>
        <H2>Exportar</H2>
        <Muted>Una copia JSON contiene todo y se puede restaurar aquí. Los archivos CSV se abren en cualquier hoja de cálculo.</Muted>
        <Button testID="export-json" title="Exportar copia completa (JSON)" onPress={exportJson} busy={busy === 'json'} disabled={busy !== null} />
        <Button title="Exportar series y registros (CSV)" kind="secondary" onPress={exportCsv} busy={busy === 'csv'} disabled={busy !== null} />
      </Card>

      <Card>
        <H2>Restaurar</H2>
        <Muted>Elige una copia JSON hecha con esta app. El archivo se comprueba antes de cambiar nada.</Muted>
        <Button title="Restaurar desde una copia" kind="secondary" onPress={restore} busy={busy === 'restore'} disabled={busy !== null} />
      </Card>

      <Card>
        <H2>Dónde están tus datos</H2>
        <Muted>Base de datos: {dbPath}</Muted>
        {Platform.OS === 'web' ? (
          <Muted>
            En un navegador, los datos son solo de ese navegador. Si borras los datos del sitio se pierden, y otros dispositivos
            no los ven. Exporta una copia de vez en cuando.
          </Muted>
        ) : null}
        {dir ? <Muted>Exportaciones: {dir}exports/</Muted> : null}
      </Card>

      <Card>
        <H2>Borrar todos los datos</H2>
        <Muted>Elimina todo de este dispositivo y deja la app como recién instalada. Nunca se tocan los datos de la plataforma de salud.</Muted>
        <Button testID="delete-all" title="Borrar todos los datos" kind="danger" onPress={deleteAll} busy={busy === 'delete'} disabled={busy !== null} />
      </Card>
    </Screen>
  );
}
