import { StyleSheet } from 'react-native';

export const uiStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  overlayContent: {
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 56,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { height: 4, width: 0 },
    textShadowRadius: 20,
  },
  gameOverTitle: {
    color: '#e63946',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.74)',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 24,
  },
  stat: {
    alignItems: 'center',
    minWidth: 76,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.56)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  shadowText: {
    textShadowColor: 'rgba(0, 0, 0, 0.62)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 10,
  },
});