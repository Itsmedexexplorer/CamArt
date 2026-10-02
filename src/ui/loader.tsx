import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import type { Shape } from '@/lib/sticker';
import { ShapeArt } from '@/ui/shape-art';

const CYCLE: Shape[] = ['stamp', 'clover', 'heart', 'flower'];

/** Loading mark: the app's shapes take turns, each turning in, holding a beat and handing off. */
export function Loader({ size = 44 }: { size?: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(CYCLE.length, { duration: CYCLE.length * 650, easing: Easing.linear }), -1, false));
  }, [p]);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {CYCLE.map((sh, i) => (
        <Glyph key={sh} i={i} sh={sh} p={p} size={size} reduce={reduce} />
      ))}
    </View>
  );
}

function Glyph({ i, sh, p, size, reduce }: { i: number; sh: Shape; p: SharedValue<number>; size: number; reduce: boolean }) {
  const style = useAnimatedStyle(() => {
    const local = (((p.value - i) % CYCLE.length) + CYCLE.length) % CYCLE.length; // 0..n
    const on = local < 1 ? Math.sin(local * Math.PI) : 0; // 0 → 1 → 0 over its turn
    return {
      opacity: on,
      transform: reduce ? [] : [{ scale: 0.6 + on * 0.4 }, { rotate: `${(local - 0.5) * 50}deg` }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute' }, style]}>
      <ShapeArt shape={sh} size={size} stroke={null} />
    </Animated.View>
  );
}
