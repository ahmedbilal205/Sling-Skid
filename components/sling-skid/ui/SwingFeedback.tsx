import { StyleSheet, Text } from 'react-native';

import { useThrottledGameSnapshot } from '../store/useThrottledGameSnapshot';
import { uiStyles } from './styles';

export default function SwingFeedback() {
  const { activeArcIndex, lineState, phase, slipBucket, tensionBucket } =
    useThrottledGameSnapshot((s) => ({
      activeArcIndex: s.activeArcIndex,
      lineState: s.swing.lineState,
      phase: s.phase,
      slipBucket: Math.floor(s.swing.slip * 20),
      tensionBucket: Math.floor(s.swing.tension * 20),
    }));

  if (phase !== 'playing' || activeArcIndex < 0) return null;

  const feedback =
    lineState === 'loading'
      ? { text: tensionBucket > 14 ? 'LOADED' : 'PULL', color: '#ffd60a' }
      : lineState === 'drifting' || slipBucket > 7
        ? { text: 'DRIFT', color: '#4cc9f0' }
        : { text: 'FEATHER', color: '#ffffff' };

  return (
    <Text pointerEvents="none" style={[styles.feedback, uiStyles.shadowText, { color: feedback.color }]}>
      {feedback.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  feedback: {
    alignSelf: 'center',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    opacity: 0.92,
    position: 'absolute',
    textAlign: 'center',
    top: '18%',
    zIndex: 6,
  },
});
