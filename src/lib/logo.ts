import { Skia } from '@shopify/react-native-skia';

import { shapePath } from './sticker';

// CamArt mark: a cherry blossom sticker (white die-cut edge) with a camera lens at its heart, on lime.
export const LOGO = { bg: '#CFF56A', edge: '#FFFFFF', petal: '#FF625A', lens: '#182033', ring: '#2E3A57', glint: '#FFFFFF' } as const;

/** Logo paths inside a `size` square; `scale` is how much of the square the blossom spans. */
export function logoParts(size: number, scale = 0.7) {
  const w = size * scale, x = (size - w) / 2, y = (size - w) / 2, cx = size / 2, cy = size / 2;
  const r = w * 0.2;
  return {
    blossom: shapePath('blossom', x, y, w),
    edgeWidth: w * 0.07, // the sticker's die-cut border, drawn as a stroke under the petals
    ring: Skia.Path.Circle(cx, cy, r * 1.22),
    lens: Skia.Path.Circle(cx, cy, r),
    glint: Skia.Path.Circle(cx - r * 0.34, cy - r * 0.34, r * 0.24),
    center: { x: cx, y: cy },
  };
}
