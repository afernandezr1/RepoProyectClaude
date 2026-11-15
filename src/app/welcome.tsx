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
      setMsg({ kind: 'error', text: `No se pudo guardar: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H1>Te damos la bienvenida a {APP_NAME}</H1>
      <Body>Un lugar tranquilo para registrar entrenamientos, descanso y cómo te sientes, a tu ritmo.</Body>
      <Card>
        <H2>No es atención médica</H2>
        <Body>{MEDICAL_DISCLAIMER}</Body>
      </Card>
      <Card>
        <H2>Tus datos se quedan aquí</H2>
        <Body>{PRIVACY_SUMMARY}</Body>
      </Card>
      <Muted>
        No hay metas que cumplir ni nada que mantener. Los días de descanso cuentan, y saltarte un día es solo un día.
      </Muted>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <Button testID="accept-disclaimer" title="Entendido, empezar" onPress={accept} busy={busy} />
    </Screen>
  );
}
