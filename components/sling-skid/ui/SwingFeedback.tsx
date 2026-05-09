import { StyleSheet, Text } from 'react-native';

import { useGameStore } from '../store/gameStore';
import { uiStyles } from './styles';

export default function SwingFeedback() {
  const phase = useGameStore((s) => s.phase);
  const activeArcIndex = useGameStore((s) => s.activeArcIndex);
  const lineState = useGameStore((s) => s.swing.lineState);
  const tension = useGameStore((s) => s.swing.tension);
  const slip = useGameStore((s) => s.swing.slip);

  if (phase !== 'playing' || activeArcIndex < 0) return null;

  const feedback =
    lineState === 'loading'
      ? { text: tension > 0.72 ? 'LOADED' : 'PULL', color: '#ffd60a' }
      : lineState === 'drifting' || slip > 0.38
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