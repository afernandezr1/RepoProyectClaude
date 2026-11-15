import { Redirect } from 'expo-router';
import React from 'react';

/** Any unknown address (e.g. the page's own path when embedded) goes to Today. */
export default function NotFound() {
  return <Redirect href="/" />;
}
