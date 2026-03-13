import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StockyCard } from './StockyCard';
import { STOCKY_COLORS } from '../theme/tokens';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class StockyErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[StockyErrorBoundary] error', error);
    console.error('[StockyErrorBoundary] component stack', info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={styles.container}>
          <StockyCard title="Ocurrió un error">
            <Text style={styles.message}>Se detectó un error en la pantalla actual.</Text>
            <Text style={styles.details}>{error.message}</Text>
          </StockyCard>
        </View>
      );
    }

    return this.props.children;
  }
}

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
