// Design system — imported by all UI components
export const theme = {
  // Colors
  bg: '#0A0F1E',
  card: '#141D2F',
  red: '#CC0000',
  darkRed: '#990000',
  text: '#FFFFFF',
  muted: '#8892A4',
  green: '#00C48C',
  yellow: '#FFB800',
  blue: '#0099FF',

  // Spacing (use these instead of magic numbers)
  pad: 16,
  padSmall: 8,
  padLarge: 24,
  gap: 12,

  // Sizing
  radius: 12,
  radiusSm: 8,

  // Typography (rem-based for web)
  titleSize: 20,
  bodySize: 14,
  labelSize: 13,
  smallSize: 12,

  // Components
  card: {
    padding: 16,
    borderRadius: 12,
    borderColor: '#1E2A3D',
  },
  button: {
    padding: 12,
    borderRadius: 8,
  },
};

// Screen titles (CAPS SPACED)
export const SCREEN_LABELS = {
  FIRST_AID: 'FIRST AID',
  BROADCAST: 'BROADCAST',
  TRIAGE: 'TRIAGE AI',
  NEARBY: 'NEARBY',
  INCIDENTS: 'INCIDENTS',
  SETTINGS: 'SETTINGS',
};
