import {
  getPushNotificationsConfig,
  subscribePushNotifications,
  unsubscribePushNotifications,
} from "../api/notificationsApi";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const isIosDevice = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent || "");

export const isStandalonePwa = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

export const getBrowserPushPermission = () =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

export const getExistingPushSubscription = async () => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

export const syncExistingPushSubscription = async ({ deviceLabel } = {}) => {
  if (!isPushSupported()) return { supported: false, subscribed: false };
  if (getBrowserPushPermission() !== "granted") {
    return { supported: true, subscribed: false, permission: getBrowserPushPermission() };
  }

  const existingSubscription = await getExistingPushSubscription();
  if (!existingSubscription) {
    return { supported: true, subscribed: false, permission: "granted" };
  }

  await subscribePushNotifications({
    subscription: existingSubscription.toJSON(),
    device_label: deviceLabel || null,
  });

  return {
    supported: true,
    subscribed: true,
    permission: "granted",
    endpoint: existingSubscription.endpoint,
  };
};

export const enablePushNotifications = async ({ deviceLabel } = {}) => {
  if (!isPushSupported()) {
    throw new Error("PUSH_NOT_SUPPORTED");
  }

  const config = await getPushNotificationsConfig();
  if (!config?.enabled || !config?.publicKey) {
    throw new Error("PUSH_NOT_CONFIGURED");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "PUSH_PERMISSION_DENIED" : "PUSH_PERMISSION_NOT_GRANTED");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  await subscribePushNotifications({
    subscription: subscription.toJSON(),
    device_label: deviceLabel || null,
  });

  return {
    supported: true,
    subscribed: true,
    permission,
    endpoint: subscription.endpoint,
  };
};

export const disablePushNotifications = async () => {
  if (!isPushSupported()) return { supported: false, subscribed: false };

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return {
      supported: true,
      subscribed: false,
      permission: getBrowserPushPermission(),
    };
  }

  await unsubscribePushNotifications({ endpoint: subscription.endpoint });
  await subscription.unsubscribe();

  return {
    supported: true,
    subscribed: false,
    permission: getBrowserPushPermission(),
  };
};
