import { onlineManager } from '@tanstack/react-query';
import { isAndroidOffline } from '@/lib/offline/android-app-shell';

/** Native connectivity can change while WebView's navigator.onLine stays true. */
export function subscribeQueryConnectivity() {
  const update = () => onlineManager.setOnline(navigator.onLine && !isAndroidOffline());
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  window.addEventListener('trinity-android-connectivity', update);
  update();
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
    window.removeEventListener('trinity-android-connectivity', update);
  };
}
