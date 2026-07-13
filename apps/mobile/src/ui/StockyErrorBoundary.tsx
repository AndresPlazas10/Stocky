import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { withTranslation, WithTranslation } from 'react-i18next';
import { StockyCard } from './StockyCard';
import { STOCKY_COLORS } from '../theme/tokens';

type Props = WithTranslation & {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

class StockyErrorBoundaryInner extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('[StockyErrorBoundary] error', error);
      console.error('[StockyErrorBoundary] component stack', info.componentStack);
    }
  }

  render() {
    const { error, t } = { ...this.state, t: this.props.t };
    if (error) {
      return (
        <View style={styles.container}>
          <StockyCard title={t('errors.errorOccurred')}>
            <Text style={styles.message}>{t('errors.errorDetected')}</Text>
            <Text style={styles.details}>{error.message}</Text>
          </StockyCard>
        </View>
      );
    }

    return this.props.children;
  }
}

export const StockyErrorBoundary = withTranslation()(StockyErrorBoundaryInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  message: {
    fontSize: 13,
    color: STOCKY_COLORS.textSecondary,
    fontWeight: '600',
  },
  details: {
    marginTop: 8,
    fontSize: 12,
    color: STOCKY_COLORS.errorText,
    fontWeight: '600',
  },
});
