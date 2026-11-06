/**
 * Local reminders only (no push server, no tokens). Everything degrades
 * gracefully: on web or when permission is denied the app keeps working and
 * the UI explains why reminders won't appear.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { toNotificationWeekday } from '../domain/dates';
import type { Reminder } from '../domain/types';

export type ReminderSyncResult =
  | { status: 'scheduled'; count: number }
  | { status: 'muted' }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

const CHANNEL_ID = 'reminders';
let handlerSet = false;

export function notificationsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function configureNotifications(): void {
  if (!notificationsSupported() || handlerSet) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  } catch {
    // Module unavailable; reminders will report "unavailable".
  }
}

async function ensurePermission(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/**
 * Cancel everything this app scheduled and reschedule from the stored
 * reminders. Muting cancels all without deleting the reminders themselves.
 */
export async function syncReminders(
  reminders: Reminder[],
  muted: boolean,
  { askPermission }: { askPermission: boolean },
): Promise<ReminderSyncResult> {
  if (!notificationsSupported()) {
    return { status: 'unavailable', reason: 'Reminders need the iOS or Android app.' };
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (muted) return { status: 'muted' };
    const active = reminders.filter((r) => r.enabled && r.weekdays.length > 0);
    if (active.length === 0) return { status: 'scheduled', count: 0 };
    if (!(await ensurePermission(askPermission))) return { status: 'denied' };
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let count = 0;
    for (const r of active) {
      for (const day of r.weekdays) {
        await Notifications.scheduleNotificationAsync({
          content: { title: r.label, body: 'A gentle reminder. Skip it whenever you like.' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: toNotificationWeekday(day),
            hour: r.hour,
            minute: r.minute,
            channelId: CHANNEL_ID,
          },
        });
        count++;
      }
    }
    return { status: 'scheduled', count };
  } catch (e) {
    return { status: 'unavailable', reason: e instanceof Error ? e.message : 'Notifications are unavailable.' };
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!notificationsSupported()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // nothing scheduled / module unavailable
  }
}
