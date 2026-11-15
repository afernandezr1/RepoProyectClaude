import { Alert, Platform } from 'react-native';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (req: ConfirmRequest) => void;
let listener: Listener | null = null;

/** Registered by <ConfirmHost/>, which draws the dialog on web. */
export function setConfirmListener(l: Listener | null): void {
  listener = l;
}

/**
 * Cross-platform confirmation. Native uses the system Alert. Web uses an
 * in-app dialog (window.confirm is unavailable inside embedded pages such as a
 * published Claude page, where it always returns false).
 */
export function confirm(title: string, message: string, confirmLabel = 'Aceptar', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (!listener) return Promise.resolve(false);
    return new Promise((resolve) => listener?.({ title, message, confirmLabel, destructive, resolve }));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
