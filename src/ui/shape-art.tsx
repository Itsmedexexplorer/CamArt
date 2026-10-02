import { Canvas, Path } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { EDGES, SHAPE_EDGE, shapePath, windowPath, type Shape } from '@/lib/sticker';
import { color } from '@/theme';

/** A bare shape glyph in its character colour, no background. */
export function ShapeArt({ shape, size = 28, fill, stroke = color.ink }: { shape: Shape; size?: number; fill?: string; stroke?: string | null }) {
  const path = useMemo(() => shapePath(shape, 2, 2, size - 4), [shape, size]);
  const win = useMemo(() => (shape === 'stamp' || shape === 'polaroid' ? windowPath(shape, 2, 2, size - 4) : null), [shape, size]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color={fill ?? EDGES[SHAPE_EDGE[shape]]} />
      {win && <Path path={win} color="rgba(24,32,51,0.28)" />}
      {stroke && <Path path={path} color={stroke} style="stroke" strokeWidth={1.5} strokeJoin="round" />}
    </Canvas>
  );
}
