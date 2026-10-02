import * as H from 'expo-haptics';

import { getSettings } from './settings';

// The haptic contract. Every haptic in the app goes through here; each moment
// also has a visual response, so haptics are never the only feedback.
// Not used: button presses, tabs, scroll, calendar taps, text.
// Capture: fires, but iOS may drop it while the camera runs, so flash + stamp-press carry it visually.
//
// Android: impact/notification use the Vibrator service, which fires even when the
// system "touch feedback" setting is off (performAndroidHapticsAsync silently doesn't).
const play = (fn: () => Promise<void>) => {
  if (getSettings().haptics) fn().catch(() => {});
};

export const haptic = {
  select: () => play(() => H.selectionAsync()),
  success: () => play(() => H.notificationAsync(H.NotificationFeedbackType.Success)),
  error: () => play(() => H.notificationAsync(H.NotificationFeedbackType.Error)),
  capture: () => play(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy)),
  delete: () => play(() => H.impactAsync(H.ImpactFeedbackStyle.Medium)),
};
