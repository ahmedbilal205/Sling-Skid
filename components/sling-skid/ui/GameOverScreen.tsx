import { Pressable, Text, View } from 'react-native';

import { useGameStore } from '../store/gameStore';
import { uiStyles } from './styles';

export default function GameOverScreen() {
  const phase = useGameStore((s) => s.phase);
  const startGame = useGameStore((s) => s.startGame);

  if (phase !== 'gameOver') return null;

  const { distance, score, turnsCompleted } = useGameStore.getState();

  return (
    <Pressable onPress={startGame} style={uiStyles.overlay}>
      <View style={uiStyles.overlayContent}>
        <Text style={[uiStyles.title, uiStyles.gameOverTitle]}>GAME OVER</Text>
        <View style={uiStyles.stats}>
          <View style={uiStyles.stat}>
            <Text style={uiStyles.statValue}>{score.toLocaleString()}</Text>
            <Text style={uiStyles.statLabel}>Score</Text>
          </View>
          <View style={uiStyles.stat}>
            <Text style={uiStyles.statValue}>{Math.floor(distance)}m</Text>
            <Text style={uiStyles.statLabel}>Distance</Text>
          </View>
          <View style={uiStyles.stat}>
            <Text style={uiStyles.statValue}>{turnsCompleted}</Text>
            <Text style={uiStyles.statLabel}>Turns</Text>
          </View>
        </View>
        <Text style={uiStyles.subtitle}>Tap to Retry</Text>
      </View>
    </Pressable>
  );
}
