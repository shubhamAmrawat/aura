// AURORA Design Tokens — mobile
// Mirrors global.css CSS variables exactly
// Change accent here to retheme the entire app

export const Colors = {
  // Backgrounds
  bgPrimary:   '#0A0A0A',
  bgSecondary: '#111111',
  bgElevated:  '#1A1A1A',
  bgOverlay:   'rgba(8, 8, 8, 0.56)',
  bgScrim:     'rgba(6, 6, 6, 0.82)',

  // Text
  textPrimary:   '#F5F0EB',
  textSecondary: '#888888',
  textMuted:     '#727070',

  // Accent — change this one value to retheme the whole app
  accent:      '#81EE4E',
  accentHover: '#D4B86A',
  accentMuted: 'rgba(201, 168, 76, 0.15)',

  // Borders
  border:      'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  cardBorder:  'rgba(255, 255, 255, 0.16)',
  cardSurface: 'rgba(15, 15, 15, 0.62)',

  // Other accent options — swap into accent above:
  // Orange: '#E8743A'
  // Amber:  '#D97706'
  // Rose:   '#E11D48'
  // Teal:   '#0D9488'
  // Gold:   '#C9A84C'
} as const;