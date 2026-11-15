import React from 'react';
import { Body, Card, H2, Muted, Screen } from '../components/ui';
import { APP_NAME, MEDICAL_DISCLAIMER, PRIVACY_SUMMARY } from '../domain/copy';

export default function About() {
  return (
    <Screen>
      <Card>
        <H2>No es atención médica</H2>
        <Body>{MEDICAL_DISCLAIMER}</Body>
        <Body>Si algo duele, no se siente bien o te encuentras mal durante el ejercicio, para y busca ayuda cualificada.</Body>
      </Card>
      <Card>
        <H2>Lo que {APP_NAME} no hace</H2>
        <Muted>• No hace diagnósticos, tratamientos ni puntuaciones de salud.</Muted>
        <Muted>• No pone objetivos de pérdida de peso, ni cuenta calorías, ni da consejos de dieta.</Muted>
        <Muted>• No castiga por romper rachas, no tiene clasificaciones ni te compara con otras personas.</Muted>
        <Muted>• No tiene cuentas, anuncios, analíticas ni servidores en la nube.</Muted>
      </Card>
      <Card>
        <H2>Privacidad</H2>
        <Body>{PRIVACY_SUMMARY}</Body>
      </Card>
    </Screen>
  );
}
