import { ScrollView, StyleSheet, View } from 'react-native';
import type { SectionId } from '../../navigation/sections';
import { SectionHost } from './sections/SectionHost';
import { StockyBackground } from '../../ui/StockyBackground';

type Props = {
  sectionId: SectionId;
};

export function DashboardSectionScreen({ sectionId }: Props) {
  return (
    <StockyBackground>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHost sectionId={sectionId} />
        </ScrollView>
      </View>
    </StockyBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 14,
  },
});
