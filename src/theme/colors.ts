/**
 * Tema visual de BeaMotion basado en beatrizsanzentrenamiento.com
 *
 * Paleta extraída del CSS de la web:
 * - Surface (#f6f2ea): fondo principal cálido
 * - Brand (#3e4a3a): color principal, texto y botones
 * - Accent (#a3ad92): acentos y elementos interactivos
 * - Muted (#e8eae1): bordes y fondos secundarios
 * - White (#fffefb): fondo de tarjetas
 */

export const colors = {
  // Colores principales de la marca
  brand: '#3e4a3a',
  brandLight: '#5c6b56',
  brandDark: '#2d3629',

  // Acentos
  accent: '#a3ad92',
  accentLight: '#c5cdc0',
  accentDark: '#8a9480',

  // Fondos
  surface: '#f6f2ea',
  surfaceLight: '#faf8f4',
  card: '#fffefb',
  muted: '#e8eae1',

  // Texto
  textPrimary: '#3e4a3a',
  textSecondary: '#6b7365',
  textMuted: '#8f968b',

  // Estados
  success: '#5a7a62',
  successBg: '#e8f0e6',
  successBorder: '#b8d0bc',
  warning: '#f99c00',
  warningBg: '#fff8e6',
  warningBorder: '#ffe0a8',
  destructive: '#c13c3b',
  destructiveBg: '#fae8e7',
  destructiveBorder: '#e5c1bf',
  error: '#c13c3b',

  // Bordes y divisores
  border: '#d8d2c4',
  borderLight: '#e8eae1',
  borderDark: '#b7b0a0',

  // UI
  white: '#fffefb',
  shadow: 'rgba(62, 74, 58, 0.1)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const typography = {
  // La web usa Instrument Sans para display y Inter para body
  // En React Native usamos la fuente del sistema como fallback
  display: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
  link: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.brand,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.accentDark,
    letterSpacing: 2,
  },
} as const;
