import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThrottledGameSnapshot } from '../store/useThrottledGameSnapshot';
import Speedometer from './Speedometer';
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
    speed,
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
    speed: s.speed,
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
          <View style={styles.statAccent} />
          <Text style={styles.label}>DIST.</Text>
          <Text style={[styles.value, uiStyles.shadowText]}>{distance}<Text style={styles.valueUnit}>m</Text></Text>
        </View>
        {combo > 0 ? (
          <View style={styles.comboWrap}>
            <Text style={styles.comboLabel}>CHAIN</Text>
            <Text style={styles.combo}>×{multiplier}</Text>
          </View>
        ) : null}
        <View style={[styles.sideItem, styles.rightItem]}>
          <View style={[styles.statAccent, styles.rightAccent]} />
          <Text style={styles.label}>SCORE</Text>
          <Text style={[styles.value, uiStyles.shadowText]}>{score.toLocaleString()}</Text>
        </View>
      </View>

      {!hasPulledIn && turnsCompleted < 3 ? (
        <View style={styles.tapHintWrap}>
          <Text style={styles.hintIndex}>01</Text>
          <Text style={styles.tapHint}>HOLD TO CUT INSIDE</Text>
          <View style={styles.tapHintRule} />
          <Text style={styles.hintIndex}>02</Text>
          <Text style={styles.tapHint}>LET GO TO SWING WIDE</Text>
        </View>
      ) : null}

      {lineReadout ? (
        <View style={styles.lineReadoutWrap}>
          <Text style={styles.lineReadoutIndex}>LINE</Text>
          <Text style={styles.lineReadout}>{lineReadout}</Text>
        </View>
      ) : null}

      <View style={[styles.bottomRow, { bottom: insets.bottom + 12 }]}>
        <Speedometer speed={speed} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  combo: {
    color: '#181713',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 29,
  },
  comboLabel: {
    color: '#181713',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  comboWrap: {
    alignItems: 'center',
    backgroundColor: '#f2cf45',
    left: '50%',
    marginLeft: -42,
    paddingHorizontal: 12,
    paddingVertical: 4,
    position: 'absolute',
    top: 7,
    transform: [{ rotate: '-2deg' }],
    width: 84,
  },
  hud: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    zIndex: 5,
  },
  label: {
    color: '#f05a28',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  lineReadout: {
    color: '#f3eddc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  lineReadoutIndex: {
    color: '#f05a28',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lineReadoutWrap: {
    alignSelf: 'center',
    borderLeftColor: '#f05a28',
    borderLeftWidth: 3,
    paddingLeft: 8,
    position: 'absolute',
    top: '48%',
  },
  rightAccent: {
    alignSelf: 'flex-end',
  },
  rightItem: {
    alignItems: 'flex-end',
  },
  sideItem: {
    minWidth: 96,
  },
  statAccent: {
    backgroundColor: '#f3eddc',
    height: 3,
    marginBottom: 5,
    transform: [{ skewX: '-28deg' }],
    width: 36,
  },
  hintIndex: {
    color: '#f05a28',
    fontSize: 8,
    fontWeight: '900',
    marginRight: 5,
  },
  tapHint: {
    color: '#1b1a16',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tapHintRule: {
    backgroundColor: 'rgba(27, 26, 22, 0.28)',
    height: 14,
    marginHorizontal: 9,
    width: 1,
  },
  tapHintWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#e7dfc9',
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
    position: 'absolute',
    top: '40%',
    transform: [{ rotate: '-1deg' }],
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  value: {
    color: '#f3eddc',
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 26,
  },
  valueUnit: {
    color: '#aaa48f',
    fontSize: 10,
    letterSpacing: 0,
  },
});
