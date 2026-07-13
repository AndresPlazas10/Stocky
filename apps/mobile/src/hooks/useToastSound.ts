import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import type { ToastType } from '../ui/StockyToast';

const SOUND_FILES: Record<ToastType, number> = {
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  warning: require('../../assets/sounds/warning.wav'),
  info: require('../../assets/sounds/info.wav'),
};

export function useToastSound() {
  const soundsRef = useRef<Map<ToastType, Audio.Sound>>(new Map());

  useEffect(() => {
    return () => {
      soundsRef.current.forEach((sound) => {
        sound.unloadAsync().catch(() => {});
      });
      soundsRef.current.clear();
    };
  }, []);

  const playSound = async (type: ToastType) => {
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
  };

  return { playSound };
}
