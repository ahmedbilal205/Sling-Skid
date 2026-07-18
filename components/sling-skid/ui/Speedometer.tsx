import { StyleSheet, Text, View } from 'react-native';

const MAX_DISPLAY_SPEED = 120;
const KMH_PER_GAME_UNIT = 3.6;
const START_ANGLE = -108;
const END_ANGLE = 108;
const TICK_COUNT = 24;

type SpeedometerProps = {
  speed: number;
};

export default function Speedometer({ speed }: SpeedometerProps) {
  const speedKmh = Math.max(0, speed * KMH_PER_GAME_UNIT);
  const gaugeProgress = Math.min(speedKmh / MAX_DISPLAY_SPEED, 1);
  const needleAngle = START_ANGLE + (END_ANGLE - START_ANGLE) * gaugeProgress;

  return (
    <View
      accessibilityLabel={`Speed ${Math.round(speedKmh)} kilometers per hour`}
      accessibilityRole="text"
      style={styles.instrument}
    >
      <View style={styles.mountingTab} />
      <View style={styles.dial}>
        {Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
          const angle = START_ANGLE + ((END_ANGLE - START_ANGLE) * index) / TICK_COUNT;
          const major = index % 6 === 0;
          const redline = index >= 20;

          return (
            <View
              key={index}
              style={[styles.tickOrbit, { transform: [{ rotate: `${angle}deg` }] }]}
            >
              <View style={[styles.tick, major && styles.majorTick, redline && styles.redlineTick]} />
            </View>
          );
        })}

        <Text style={[styles.scaleLabel, styles.zeroLabel]}>0</Text>
        <Text style={[styles.scaleLabel, styles.sixLabel]}>6</Text>
        <Text style={[styles.scaleLabel, styles.twelveLabel]}>12</Text>

        <View style={[styles.needleOrbit, { transform: [{ rotate: `${needleAngle}deg` }] }]}>
          <View style={styles.needleCounterweight} />
          <View style={styles.needle} />
        </View>
        <View style={styles.needlePin} />

        <View style={styles.readout}>
          <Text style={styles.speedValue}>{Math.round(speedKmh)}</Text>
          <Text style={styles.speedUnit}>KM/H</Text>
        </View>
      </View>

      <View style={[styles.screw, styles.leftScrew]} />
      <View style={[styles.screw, styles.rightScrew]} />
      <View style={styles.calibrationMark} />
      <Text style={styles.serial}>SS—01</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calibrationMark: {
    backgroundColor: '#f05a28',
    height: 4,
    left: 7,
    position: 'absolute',
    top: 47,
    transform: [{ rotate: '-8deg' }],
    width: 23,
  },
  dial: {
    backgroundColor: '#191915',
    borderColor: '#e7dfc9',
    borderRadius: 88,
    borderWidth: 4,
    height: 176,
    left: 14,
    position: 'absolute',
    top: 5,
    width: 176,
  },
  instrument: {
    height: 128,
    overflow: 'hidden',
    position: 'relative',
    width: 204,
  },
  leftScrew: {
    left: 19,
  },
  majorTick: {
    height: 14,
    width: 3,
  },
  mountingTab: {
    backgroundColor: '#d8d0ba',
    height: 40,
    left: 3,
    position: 'absolute',
    top: 35,
    transform: [{ rotate: '-7deg' }],
    width: 198,
  },
  needle: {
    backgroundColor: '#f05a28',
    height: 63,
    left: 68,
    position: 'absolute',
    top: 4,
    width: 3,
  },
  needleCounterweight: {
    backgroundColor: '#f05a28',
    height: 17,
    left: 68,
    position: 'absolute',
    top: 72,
    width: 3,
  },
  needleOrbit: {
    height: 140,
    left: 18,
    position: 'absolute',
    top: 14,
    width: 140,
  },
  needlePin: {
    backgroundColor: '#e7dfc9',
    borderColor: '#f05a28',
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    left: 80,
    position: 'absolute',
    top: 76,
    width: 16,
  },
  readout: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 88,
    justifyContent: 'center',
  },
  redlineTick: {
    backgroundColor: '#f05a28',
  },
  rightScrew: {
    right: 19,
  },
  scaleLabel: {
    color: '#a9a390',
    fontSize: 9,
    fontWeight: '900',
    position: 'absolute',
  },
  screw: {
    backgroundColor: '#777363',
    borderColor: '#24231f',
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    position: 'absolute',
    top: 58,
    width: 8,
  },
  serial: {
    color: '#282721',
    fontSize: 7,
    fontWeight: '900',
    left: 3,
    letterSpacing: 0.8,
    position: 'absolute',
    top: 78,
    transform: [{ rotate: '-7deg' }],
  },
  sixLabel: {
    alignSelf: 'center',
    top: 18,
  },
  speedUnit: {
    color: '#a9a390',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 5,
    marginLeft: 5,
  },
  speedValue: {
    color: '#f3eddc',
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 36,
    minWidth: 58,
    textAlign: 'right',
  },
  tick: {
    alignSelf: 'center',
    backgroundColor: '#8e8978',
    height: 8,
    width: 2,
  },
  tickOrbit: {
    height: 158,
    left: 9,
    position: 'absolute',
    top: 5,
    width: 158,
  },
  twelveLabel: {
    right: 14,
    top: 75,
  },
  zeroLabel: {
    left: 14,
    top: 75,
  },
});
