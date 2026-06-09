import { ScrollView, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { SectionId } from '../../navigation/sections';
import { SectionHost } from './sections/SectionHost';
import { StockyBackground } from '../../ui/StockyBackground';

type Props = {
  sectionId?: SectionId;
};

export function DashboardSectionScreen({ sectionId: propSectionId }: Props = {}) {
  const route = useRoute<any>();
  const sectionId = propSectionId || (route?.params?.sectionId as SectionId);

  if (!sectionId) return null;

  const useNativeSectionScroll = sectionId === 'inventario'
    || sectionId === 'combos'
    || sectionId === 'proveedores';

  return (
    <StockyBackground>
      <View style={styles.container}>
        {useNativeSectionScroll ? (
          <View style={styles.nativeSectionContainer}>
            <SectionHost sectionId={sectionId} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <SectionHost sectionId={sectionId} />
          </ScrollView>
        )}
      </View>
    </StockyBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nativeSectionContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 14,
  },
});
