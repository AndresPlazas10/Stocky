/* global self, clients */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event?.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Stocky',
      body: event?.data ? event.data.text() : 'Tienes una nueva notificacion.',
      data: {},
    };
  }

  const title = String(payload?.title || 'Stocky').trim() || 'Stocky';
  const body = String(payload?.body || 'Tienes una nueva notificacion.').trim();
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = String(event?.notification?.data?.url || '/dashboard').trim() || '/dashboard';

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try {
            await client.navigate(targetPath);
          } catch {
            // no-op
          }
        }
        return;
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(targetPath);
    }
  })());
});
