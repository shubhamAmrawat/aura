// AURORA Design Tokens — mobile
// Mirrors global.css CSS variables exactly
// Change accent here to retheme the entire app

export const Colors = {
  // Backgrounds
  bgPrimary:   '#000000',
  bgSecondary: '#0A0A0A',
  bgElevated:  '#141414',
  bgOverlay:   'rgba(0, 0, 0, 0.56)',
  bgScrim:     'rgba(0, 0, 0, 0.82)',
  bgBar:       'rgba(10, 10, 10, 0.97)', // sticky bottom bars

  // Text
  textPrimary:   '#F5F0EB',
  textSecondary: '#888888',
  textMuted:     '#727070',

  // Accent — change this one value to retheme the whole app
  accent:      '#81EE4E',
  accentHover: '#6fd93c',
  accentMuted: 'rgba(129, 238, 78, 0.15)',

  // Borders
  border:      'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  cardBorder:  'rgba(255, 255, 255, 0.16)',
  cardSurface: 'rgba(10, 10, 10, 0.62)',

  // Other accent options — swap into accent above:
  // Orange: '#E8743A'
  // Amber:  '#D97706'
  // Rose:   '#E11D48'
  // Teal:   '#0D9488'
  // Gold:   '#C9A84C'
} as const;