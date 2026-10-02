import { Blur, Canvas, Circle } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { color, motion } from '@/theme';

/** Soft colour field behind the sticker, in its edge colour. Fades when the colour changes; never loops. */
export function Backdrop({ tint, width, height }: { tint: string; width: number; height: number }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withSequence(withTiming(0.35, { duration: 0 }), withTiming(1, { duration: motion.sheet })));
  }, [tint, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={width * 0.15} cy={height * 0.22} r={width * 0.6} color={tint} opacity={0.55}>
          <Blur blur={70} />
        </Circle>
        <Circle cx={width * 0.95} cy={height * 0.42} r={width * 0.45} color={color.lilac} opacity={0.45}>
          <Blur blur={70} />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}
