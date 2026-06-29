const NOTIFICATION_ICON = '/rconnectx-icon.png'
const NOTIFICATION_BADGE = '/rconnectx-badge.png'

self.addEventListener('push', (event) => {
  let payload = {
    title: 'RConnectX',
    body: 'You have a new notification',
    link_url: '/notifications',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        link_url: parsed.link_url || payload.link_url,
      }
    }
  } catch {
    // Fall back to default payload.
  }

  const absoluteLink = new URL(payload.link_url, self.location.origin).href
  const iconUrl = new URL(NOTIFICATION_ICON, self.location.origin).href
  const badgeUrl = new URL(NOTIFICATION_BADGE, self.location.origin).href

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: iconUrl,
      badge: badgeUrl,
      image: iconUrl,
      tag: 'rconnectx-notification',
      data: { link_url: absoluteLink },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.link_url || new URL('/notifications', self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if ('navigate' in focused) {
              return focused.navigate(targetUrl)
            }
            return focused
          })
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    }),
  )
})
