import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SHAPE_LABEL, SHAPES, type Shape } from '@/lib/sticker';
import { color, settle } from '@/theme';
import { ShapeArt } from '@/ui/shape-art';

const STEP = (8 * Math.PI) / 180; // angle between shapes on the wheel
const GLYPH = 40;
const H = 76;

/** Rotary wheel of bare shape glyphs, like a lens ring seen edge-on. Drag or flick; it glides to rest on one. */
export function ShapeDial({ width, value, onChange }: { width: number; value: Shape; onChange: (s: Shape) => void }) {
  const R = width * 1.5;
  const px = R * STEP; // drag distance per shape
  const pos = useSharedValue(SHAPES.indexOf(value));
  const start = useSharedValue(0);
  const last = SHAPES.length - 1;

  useEffect(() => {
    pos.set(withSpring(SHAPES.indexOf(value), settle));
  }, [value, pos]);

  const done = (i: number) => onChange(SHAPES[i]);

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onBegin(() => start.set(pos.value))
    .onUpdate((e) => pos.set(Math.min(Math.max(start.value - e.translationX / px, -0.35), last + 0.35)))
    .onEnd((e) => {
      const v = -e.velocityX / px; // shapes per second
      const target = Math.min(Math.max(Math.round(pos.value + v * 0.18), 0), last);
      pos.set(withSpring(target, { ...settle, velocity: v }));
      scheduleOnRN(done, target);
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[s.dial, { width }]}
        accessibilityRole="adjustable"
        accessibilityLabel={`Frame shape, ${SHAPE_LABEL[value]}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const i = SHAPES.indexOf(value) + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          if (i >= 0 && i <= last) onChange(SHAPES[i]);
        }}>
        <View style={[s.tick, { left: width / 2 - 3 }]} />
        {SHAPES.map((sh, i) => (
          <Item key={sh} i={i} sh={sh} pos={pos} R={R} cx={width / 2} onPress={() => onChange(sh)} />
        ))}
      </View>
    </GestureDetector>
  );
}

function Item({ i, sh, pos, R, cx, onPress }: { i: number; sh: Shape; pos: SharedValue<number>; R: number; cx: number; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = i - pos.value;
    const a = d * STEP;
    const far = Math.abs(d);
    return {
      opacity: far > 3.5 ? 0 : 1 - far * 0.24,
      transform: [
        { translateX: cx + R * Math.sin(a) - GLYPH / 2 },
        { translateY: 14 + R * (1 - Math.cos(a)) },
        { rotate: `${a}rad` },
        { scale: far < 1 ? 1.3 - far * 0.45 : Math.max(0.85 - (far - 1) * 0.08, 0.6) },
      ],
    };
  });
  return (
    <Animated.View style={[s.item, style]}>
      <Pressable onPress={onPress} hitSlop={8} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ShapeArt shape={sh} size={GLYPH} stroke={null} />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  dial: { height: H, overflow: 'hidden' },
  tick: { position: 'absolute', top: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: color.paper },
  item: { position: 'absolute', left: 0, top: 0 },
});
