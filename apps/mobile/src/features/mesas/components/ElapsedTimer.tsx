import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatElapsedTime } from '@stocky/shared';

interface ElapsedTimerProps {
  startedAt: number;
}

/**
 * Temporizador de la cocina: muestra cuánto tiempo lleva el pedido en cocina
 * desde su llegada (startedAt). Tic local de 1s: solo re-renderiza este chip.
 * Al cambiar startedAt (pedido nuevo o cambio) se reinicia desde 00:00.
 */
export function ElapsedTimer({ startedAt }: ElapsedTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsedMs = startedAt > 0 ? now - startedAt : 0;

  return (
    <View style={styles.chip}>
      <Ionicons name="time-outline" size={13} color="#FFFFFF" />
      <Text style={styles.text}>{formatElapsedTime(elapsedMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
