import { Blur, Canvas, Circle, Rect } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The colour field every page floats on: big, soft blobs of the brand accents. Glass surfaces
 * read as frosted because there's always colour behind them. Static and drawn once (cheap).
 */
export function Ambient() {
  const { c, scheme } = useTheme();
  const { width: w, height: h } = useWindowDimensions();
  const o = scheme === 'dark' ? 0.32 : 0.55;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={w} height={h} color={c.milk} />
      <Circle cx={w * 0.1} cy={h * 0.12} r={w * 0.55} color={c.lime} opacity={o}><Blur blur={80} /></Circle>
      <Circle cx={w * 0.95} cy={h * 0.3} r={w * 0.5} color={c.lilac} opacity={o}><Blur blur={80} /></Circle>
      <Circle cx={w * 0.2} cy={h * 0.62} r={w * 0.48} color={c.gum} opacity={o * 0.7}><Blur blur={90} /></Circle>
      <Circle cx={w * 0.9} cy={h * 0.88} r={w * 0.55} color={c.sun} opacity={o * 0.75}><Blur blur={90} /></Circle>
    </Canvas>
  );
}
