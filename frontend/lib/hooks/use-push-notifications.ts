'use client'

import { useEffect } from 'react'
import { notificationsAPI } from '@/services/api'

const PERMISSION_KEY = 'rconnectx_push_permission_asked'
const VAPID_VERSION_STORAGE = 'rconnectx_vapid_subscription_version'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/sw.js?v=2', { scope: '/' })
    await navigator.serviceWorker.ready
    return registration
  } catch {
    return null
  }
}

async function clearBrowserPushSubscription() {
  const registration = await registerServiceWorker()
  if (!registration?.pushManager) return
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
  }
}

async function syncWebPushSubscription(vapidPublicKey: string, subscriptionVersion: string) {
  const registration = await registerServiceWorker()
  if (!registration?.pushManager) return

  const storedVersion = localStorage.getItem(VAPID_VERSION_STORAGE)
  const versionChanged = Boolean(storedVersion && storedVersion !== subscriptionVersion)

  if (versionChanged) {
    await clearBrowserPushSubscription()
  }

  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
  let subscription = await registration.pushManager.getSubscription()

  if (subscription && versionChanged) {
    await subscription.unsubscribe()
    subscription = null
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  }

  localStorage.setItem(VAPID_VERSION_STORAGE, subscriptionVersion)
  const subscriptionJson = JSON.stringify(subscription.toJSON())
  await notificationsAPI.registerPushToken({
    platform: 'web',
    token: subscription.endpoint,
    subscription_json: subscriptionJson,
  })
}

/**
 * Requests notification permission once, then keeps the browser Push subscription
 * in sync with the backend for background Web Push delivery.
 */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    const run = async () => {
      try {
        const { data: config } = await notificationsAPI.getPushConfig()
        const vapidKey = (config?.vapid_public_key as string | undefined)?.trim()
        const subscriptionVersion = (config?.subscription_version as string | undefined)?.trim()
        if (!vapidKey || !config?.web_push_enabled || !subscriptionVersion) {
          console.warn('Web push disabled on server', config?.vapid_error || config)
          return
        }

        const storedVersion = localStorage.getItem(VAPID_VERSION_STORAGE)
        if (storedVersion && storedVersion !== subscriptionVersion) {
          await clearBrowserPushSubscription()
          localStorage.removeItem(VAPID_VERSION_STORAGE)
        }

        const alreadyAsked = localStorage.getItem(PERMISSION_KEY) === 'true'
        let permission = Notification.permission

        if (permission === 'default' && !alreadyAsked) {
          permission = await Notification.requestPermission()
          localStorage.setItem(PERMISSION_KEY, 'true')
        }

        if (permission !== 'granted') return

        await syncWebPushSubscription(vapidKey, subscriptionVersion)
      } catch (error) {
        console.warn('Web push setup failed', error)
      }
    }

    void run()
  }, [enabled])
}
