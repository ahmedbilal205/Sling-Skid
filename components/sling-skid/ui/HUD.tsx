import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThrottledGameSnapshot } from '../store/useThrottledGameSnapshot';
import { uiStyles } from './styles';

export default function HUD() {
  const insets = useSafeAreaInsets();
  const {
    activeArcIndex,
    combo,
    distance,
    hasPulledIn,
    lineState,
    multiplier,
    phase,
    score,
    speedPercent,
    tensionBucket,
    turnsCompleted,
  } = useThrottledGameSnapshot((s) => ({
    activeArcIndex: s.activeArcIndex,
    combo: s.combo,
    distance: Math.floor(s.distance),
    hasPulledIn: s.hasPulledIn,
    lineState: s.swing.lineState,
    multiplier: s.multiplier,
    phase: s.phase,
    score: s.score,
    speedPercent: Math.min((s.speed / 30) * 100, 100),
    tensionBucket: Math.floor(s.swing.tension * 20),
    turnsCompleted: s.turnsCompleted,
  }));

  if (phase !== 'playing') return null;

  const lineReadout =
    activeArcIndex < 0
      ? null
      : lineState === 'loading'
        ? 'Pulling In'
        : lineState === 'drifting'
          ? 'Drifting Wide'
          : tensionBucket > 1
            ? 'Holding Edge'
            : 'Feathering';

  return (
    <View
      pointerEvents="none"
      style={[styles.hud, { paddingTop: insets.top + 14 }]}
    >
      <View style={styles.topRow}>
        <View style={styles.sideItem}>
          <Text style={[styles.value, uiStyles.shadowText]}>{distance}m</Text>
          <Text style={styles.label}>Distance</Text>
        </View>
        {combo > 0 ? (
          <View style={styles.comboWrap}>
            <Text style={[styles.combo, uiStyles.shadowText]}>x{multiplier}</Text>
          </View>
        ) : null}
        <View style={[styles.sideItem, styles.rightItem]}>
          <Text style={[styles.value, uiStyles.shadowText]}>{score.toLocaleString()}</Text>
          <Text style={styles.label}>Score</Text>
        </View>
      </View>

      {!hasPulledIn && turnsCompleted < 3 ? (
        <Text style={[styles.tapHint, uiStyles.shadowText]}>HOLD to pull in - RELEASE to float wide</Text>
      ) : null}

      {lineReadout ? <Text style={[styles.lineReadout, uiStyles.shadowText]}>{lineReadout}</Text> : null}

      <View style={[styles.bottomRow, { bottom: insets.bottom + 12 }]}>
        <View style={styles.speedTrack}>
          <View style={[styles.speedBar, { width: `${speedPercent}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomRow: {
    left: 14,
    position: 'absolute',
    right: 14,
  },
  combo: {
    color: '#ffd60a',
    fontSize: 26,
    fontWeight: '900',
  },
  comboWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 4,
  },
  hud: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    zIndex: 5,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lineReadout: {
    alignSelf: 'center',
    color: 'rgba(255, 255, 255, 0.74)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    position: 'absolute',
    textAlign: 'center',
    textTransform: 'uppercase',
    top: '48%',
  },
  rightItem: {
    alignItems: 'flex-end',
  },
  sideItem: {
    minWidth: 104,
  },
  speedBar: {
    backgroundColor: '#4cc9f0',
    borderRadius: 2,
    height: 4,
  },
  speedTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
  },
  tapHint: {
    alignSelf: 'center',
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 18,
    fontWeight: '800',
    position: 'absolute',
    textAlign: 'center',
    top: '40%',
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  value: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
});
