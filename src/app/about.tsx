import React from 'react';
import { Body, Card, H2, Muted, Screen } from '../components/ui';
import { APP_NAME, MEDICAL_DISCLAIMER, PRIVACY_SUMMARY } from '../domain/copy';

export default function About() {
  return (
    <Screen>
      <Card>
        <H2>Not medical care</H2>
        <Body>{MEDICAL_DISCLAIMER}</Body>
        <Body>If something hurts, feels wrong, or you feel unwell during exercise, stop and seek qualified help.</Body>
      </Card>
      <Card>
        <H2>What {APP_NAME} does not do</H2>
        <Muted>• No diagnosis, treatment, or health scores.</Muted>
        <Muted>• No weight-loss targets, calorie counting, or diet coaching.</Muted>
        <Muted>• No streak penalties, leaderboards, or comparisons with other people.</Muted>
        <Muted>• No accounts, ads, analytics, or cloud servers.</Muted>
      </Card>
      <Card>
        <H2>Privacy</H2>
        <Body>{PRIVACY_SUMMARY}</Body>
      </Card>
    </Screen>
  );
}
