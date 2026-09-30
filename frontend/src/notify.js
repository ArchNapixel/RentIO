// Notifications: the phone's own in the Android app, the browser's on the web.
// ponytail: they only appear while the app is open or alive in the background. Real push (Firebase) is what wakes a closed app.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const native = Capacitor.isNativePlatform();

// 'granted' | 'denied' | 'default' (not asked yet) | 'unsupported'
const fromNative = (state) => (state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'default');

export async function notifyPermission() {
  if (native) return fromNative((await LocalNotifications.checkPermissions()).display);
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function askNotifyPermission() {
  if (native) return fromNative((await LocalNotifications.requestPermissions()).display);
  return Notification.requestPermission();
}

// Android wants a number for each notification; the same alert id always maps to the same number.
const numericId = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 2147483646) + 1; };

export async function notify(id, title, body) {
  if (native) return LocalNotifications.schedule({ notifications: [{ id: numericId(id), title, body }] });
  new Notification(title, { body, tag: id });
}
