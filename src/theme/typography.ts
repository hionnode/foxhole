import { PixelRatio } from 'react-native';

const fontFamily = '0xProto-Regular';

const scale = PixelRatio.getFontScale();

const adjustSize = (size: number): number => {
  if (scale > 1.3) return size * 0.85;
  if (scale < 0.85) return size * 1.1;
  return size;
};

export const typography = {
  fontFamily,
  timer: {
    fontFamily,
    fontSize: adjustSize(72),
    lineHeight: adjustSize(80),
  },
  heading: {
    fontFamily,
    fontSize: adjustSize(20),
    lineHeight: adjustSize(28),
  },
  body: {
    fontFamily,
    fontSize: adjustSize(16),
    lineHeight: adjustSize(24),
  },
  label: {
    fontFamily,
    fontSize: adjustSize(12),
    lineHeight: adjustSize(16),
  },
} as const;
