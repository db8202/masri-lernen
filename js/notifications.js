import { getTodayCount } from './srs.js';

const REMINDER_KEY = 'masri_reminder_state';

export function isNotificationSupported() {
  return 'Notification' in window;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function parseTime(timeStr) {
  const [h, m] = String(timeStr || '18:00').split(':').map(Number);
  return { hours: h || 18, minutes: m || 0 };
}

export function scheduleReminderCheck(settings, profileId, dailyGoal) {
  if (!settings?.reminderEnabled || !isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const { hours, minutes } = parseTime(settings.reminderTime);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  const stateKey = `${REMINDER_KEY}_${profileId}`;
  const today = now.toISOString().slice(0, 10);
  const state = JSON.parse(localStorage.getItem(stateKey) || '{}');

  const todayCount = getTodayCount(profileId);
  const goalMet = todayCount >= (dailyGoal || 10);

  // Show reminder if time passed today and not yet reminded
  if (now >= target && state.lastReminderDate !== today && !goalMet) {
    showReminderNotification(dailyGoal - todayCount);
    localStorage.setItem(stateKey, JSON.stringify({ lastReminderDate: today }));
  }

  // Register with service worker for next check
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_REMINDER',
      payload: { hours, minutes, profileId, dailyGoal, goalMet },
    });
  }
}

function showReminderNotification(remaining) {
  const title = '🇪🇬 Masri Lernen';
  const body = remaining > 0
    ? `Noch ${remaining} Wörter bis zum Tagesziel – kurz üben?`
    : 'Zeit für deine tägliche Ägyptisch-Lektion!';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: './icons/icon.svg',
        badge: './icons/icon.svg',
        tag: 'masri-daily-reminder',
        renotify: true,
      });
    });
  } else {
    new Notification(title, { body });
  }
}

export async function initNotifications(settings, profileId, dailyGoal) {
  if (!settings?.reminderEnabled) return;
  const perm = await requestNotificationPermission();
  if (perm === 'granted') scheduleReminderCheck(settings, profileId, dailyGoal);
}
