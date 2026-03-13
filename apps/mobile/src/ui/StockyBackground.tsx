import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../theme/tokens';

export function StockyBackground({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={[STOCKY_COLORS.backgroundSoft, STOCKY_COLORS.backgroundBase]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(102, 165, 173, 0.20)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 59, 70, 0.14)',
  },
});
