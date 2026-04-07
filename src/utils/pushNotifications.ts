import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Get public VAPID key from server
    const response = await fetch('/api/vapid-public-key');
    if (!response.ok) {
      throw new Error('Failed to fetch VAPID public key');
    }
    
    let publicKey;
    try {
      const data = await response.json();
      publicKey = data.publicKey;
    } catch (e) {
      console.warn('Push notifications are not fully configured on this environment (missing VAPID key endpoint).');
      return;
    }

    if (!publicKey) return;

    // Subscribe to push notifications
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    // Save subscription to Firestore
    const subJson = subscription.toJSON();
    if (!subJson.endpoint) return;

    // Check if subscription already exists
    const subsRef = collection(db, 'push_subscriptions');
    const q = query(subsRef, where('endpoint', '==', subJson.endpoint));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      await addDoc(subsRef, {
        userId,
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        createdAt: new Date().toISOString()
      });
      console.log('Successfully subscribed to push notifications');
    } else {
      console.log('Push subscription already exists');
    }
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
  }
}

export async function sendPushNotificationToUser(recipientId: string, payload: any) {
  try {
    // Fetch recipient's subscriptions
    const subsRef = collection(db, 'push_subscriptions');
    const q = query(subsRef, where('userId', '==', recipientId));
    const subSnapshot = await getDocs(q);

    const sendPromises = subSnapshot.docs.map(async (docSnap) => {
      const subData = docSnap.data();
      const subscription = {
        endpoint: subData.endpoint,
        keys: subData.keys
      };

      await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription,
          payload
        })
      });
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
