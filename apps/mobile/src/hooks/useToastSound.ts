import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import type { ToastType } from '../ui/StockyToast';

const SOUND_FILES: Record<ToastType, number> = {
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  warning: require('../../assets/sounds/warning.wav'),
  info: require('../../assets/sounds/info.wav'),
};

const KITCHEN_ALERT_FILE = require('../../assets/sounds/kitchen.wav');

export function useToastSound() {
  const soundsRef = useRef<Map<ToastType, Audio.Sound>>(new Map());
  const kitchenAlertRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundsRef.current.forEach((sound) => {
        sound.unloadAsync().catch(() => {});
      });
      soundsRef.current.clear();
      kitchenAlertRef.current?.unloadAsync().catch(() => {});
      kitchenAlertRef.current = null;
    };
  }, []);

  const playSound = useCallback(async (type: ToastType) => {
    try {
      let sound = soundsRef.current.get(type);

      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(SOUND_FILES[type], {
          volume: 0.5,
        });
        sound = newSound;
        soundsRef.current.set(type, sound);
      }

      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // Silently ignore — sound is non-critical
    }
  }, []);

  const playKitchenAlert = useCallback(async () => {
    try {
      if (!kitchenAlertRef.current) {
        const { sound } = await Audio.Sound.createAsync(KITCHEN_ALERT_FILE, {
          volume: 1.0,
        });
        kitchenAlertRef.current = sound;
      }

      await kitchenAlertRef.current.setPositionAsync(0);
      await kitchenAlertRef.current.playAsync();
    } catch {
      // Silently ignore — sound is non-critical
    }
  }, []);

  return { playSound, playKitchenAlert };
}
