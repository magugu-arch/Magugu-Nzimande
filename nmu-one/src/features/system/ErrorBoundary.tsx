import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { colors, StateView } from '@/design';

/**
 * Last line of defence: a render error shows a recovery path instead of a
 * white screen (brief §19 "clear recovery paths for errors").
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Production: forward to the error reporter configured in the BFF, after
    // scrubbing. Never log personal data.
    console.error('NMU ONE render error', error.message, info.componentStack?.split('\n')[1]);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <StateView
          kind="error"
          title="Something went wrong"
          body="This screen hit a problem. Your information is safe."
          actionLabel="Start again"
          onAction={() => this.setState({ failed: false })}
        />
      </View>
    );
  }
}
