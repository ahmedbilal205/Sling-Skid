import { Pressable, Text, View } from 'react-native';

import { useGameStore } from '../store/gameStore';
import { uiStyles } from './styles';

export default function StartScreen() {
  const phase = useGameStore((s) => s.phase);
  const startGame = useGameStore((s) => s.startGame);

  if (phase !== 'menu') return null;

  return (
    <Pressable onPress={startGame} style={uiStyles.overlay}>
      <View style={uiStyles.overlayContent}>
        <Text style={uiStyles.title}>SLING SKID</Text>
        <Text style={uiStyles.subtitle}>Tap to Start</Text>
      </View>
    </Pressable>
  );
}