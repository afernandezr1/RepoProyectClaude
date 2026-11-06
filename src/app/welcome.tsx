import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, errorMessage, type BannerMessage } from '../components/states';
import { Body, Button, Card, H1, H2, Muted, Screen } from '../components/ui';
import { APP_NAME, MEDICAL_DISCLAIMER, PRIVACY_SUMMARY } from '../domain/copy';
import { useApp } from '../state/AppContext';

export default function Welcome() {
  const { updateSettings } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<BannerMessage | null>(null);

  const accept = async () => {
    setBusy(true);
    try {
      await updateSettings({ disclaimerAcknowledged: true });
      router.replace('/');
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't save: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H1>Welcome to {APP_NAME}</H1>
      <Body>A calm place to log workouts, rest, and how you feel — at your own pace.</Body>
      <Card>
        <H2>Not medical care</H2>
        <Body>{MEDICAL_DISCLAIMER}</Body>
      </Card>
      <Card>
        <H2>Your data stays here</H2>
        <Body>{PRIVACY_SUMMARY}</Body>
      </Card>
      <Muted>
        There are no goals to hit and nothing to keep up with. Rest days count, and skipping a day is just a day.
      </Muted>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <Button testID="accept-disclaimer" title="I understand — get started" onPress={accept} busy={busy} />
    </Screen>
  );
}
