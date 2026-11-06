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
  const { store, dbPath, bump, updateSettings } = useApp();
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
          ? `Saved ${saved.filename}${saved.shared ? '' : ' in the app’s documents folder'}.`
          : `Downloaded ${saved.filename}.`,
      });
    } catch (e) {
      setMsg({ kind: 'error', text: `Export failed: ${errorMessage(e)}` });
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
      setMsg({ kind: 'success', text: `Saved ${a.filename} and ${l.filename}.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Export failed: ${errorMessage(e)}` });
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
        'Replace all data?',
        `This backup from ${b.exportedAt.slice(0, 10)} has ${b.workouts.length} workouts and ${b.logs.length} log entries. It will replace everything currently in the app.`,
        'Replace',
        true,
      );
      if (!ok) return;
      await store.importAll(b);
      await updateSettings({});
      await syncReminders(b.reminders, b.settings.remindersMuted, { askPermission: false });
      bump();
      setMsg({ kind: 'success', text: 'Backup restored.' });
    } catch (e) {
      setMsg({ kind: 'error', text: `Restore failed and nothing was changed: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const deleteAll = async () => {
    const first = await confirm(
      'Delete everything?',
      'All workouts, templates, logs, routine, reminders and settings will be permanently removed from this device. Consider exporting first.',
      'Continue',
      true,
    );
    if (!first) return;
    const second = await confirm('Are you sure?', 'This cannot be undone.', 'Delete everything', true);
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
      setMsg({ kind: 'error', text: `Deletion failed: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const dir = documentDirectoryUri();

  return (
    <Screen>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <Body>{PRIVACY_SUMMARY}</Body>

      <Card>
        <H2>Export</H2>
        <Muted>A JSON backup contains everything and can be restored here. CSV files open in any spreadsheet.</Muted>
        <Button testID="export-json" title="Export full backup (JSON)" onPress={exportJson} busy={busy === 'json'} disabled={busy !== null} />
        <Button title="Export sets & logs (CSV)" kind="secondary" onPress={exportCsv} busy={busy === 'csv'} disabled={busy !== null} />
      </Card>

      <Card>
        <H2>Restore</H2>
        <Muted>Pick a JSON backup made by this app. The file is checked before anything changes.</Muted>
        <Button title="Restore from backup" kind="secondary" onPress={restore} busy={busy === 'restore'} disabled={busy !== null} />
      </Card>

      <Card>
        <H2>Where your data lives</H2>
        <Muted>Database: {Platform.OS === 'web' ? 'browser storage (OPFS) for this site' : dbPath}</Muted>
        {dir ? <Muted>Exports: {dir}exports/</Muted> : null}
      </Card>

      <Card>
        <H2>Delete all data</H2>
        <Muted>Removes everything from this device and returns the app to a fresh install. Health-platform data is never touched.</Muted>
        <Button testID="delete-all" title="Delete all data" kind="danger" onPress={deleteAll} busy={busy === 'delete'} disabled={busy !== null} />
      </Card>
    </Screen>
  );
}
