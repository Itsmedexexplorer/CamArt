import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { SHAPE_LABEL, SHAPES, type Shape } from '@/lib/sticker';
import { color, settle } from '@/theme';
import { ShapeArt } from '@/ui/shape-art';

const DEG = Math.PI / 180;
const STEP = 24 * DEG; // angle between shapes on the ring
const SEL = 45 * DEG; // the selected shape rests halfway round, between 12 and 3 o'clock
const FROM = -8 * DEG, TO = 98 * DEG; // the visible quarter (plus a little), measured clockwise from 12 o'clock
const GLYPH = 40;

/**
 * Free-floating shapes on a bent path curled around the shutter, from 12 o'clock to 3 o'clock.
 * Angles run clockwise from the top. Drag around the ring or flick it; it glides to rest
 * with a haptic tick each time a shape passes the marker, like a real detented dial.
 * `cx, cy` is the shutter's centre in the parent; `R` the ring's radius.
 */
export function ShapeDial({ cx, cy, R, value, onChange }: { cx: number; cy: number; R: number; value: Shape; onChange: (s: Shape) => void }) {
  const pos = useSharedValue(SHAPES.indexOf(value));
  const start = useSharedValue(0);
  const grab = useSharedValue(0);
  const last = SHAPES.length - 1;

  // Box around the quarter ring; (ox, oy) is the shutter centre inside it.
  const pad = GLYPH;
  const ox = pad, oy = R + pad;
  const size = R + pad * 2;

  useEffect(() => {
    pos.set(withSpring(SHAPES.indexOf(value), settle));
  }, [value, pos]);

  // Detent: tick whenever a new shape reaches the marker (drag, flick or tap glide).
  useAnimatedReaction(
    () => Math.round(Math.min(Math.max(pos.value, 0), last)),
    (cur, prev) => {
      if (prev !== null && cur !== prev) scheduleOnRN(haptic.select);
    },
  );

  const done = (i: number) => onChange(SHAPES[i]);
  const angleAt = (x: number, y: number) => {
    'worklet';
    return Math.atan2(x - ox, oy - y); // clockwise from 12 o'clock
  };

  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin((e) => {
      start.set(pos.value);
      grab.set(angleAt(e.x, e.y));
    })
    .onUpdate((e) => {
      // The shape under your finger follows it round the ring.
      const d = angleAt(e.x, e.y) - grab.value;
      pos.set(Math.min(Math.max(start.value - d / STEP, -0.35), last + 0.35));
    })
    .onEnd((e) => {
      const a = angleAt(e.x, e.y);
      const r = Math.max(Math.hypot(e.x - ox, e.y - oy), 1);
      const w = (e.velocityX * Math.cos(a) + e.velocityY * Math.sin(a)) / r; // angular velocity, rad/s
      const v = -w / STEP; // shapes per second
      const target = Math.min(Math.max(Math.round(pos.value + v * 0.18), 0), last);
      pos.set(withSpring(target, { ...settle, velocity: v }));
      scheduleOnRN(done, target);
    });

  // Marker just outside the ring at the selected spot.
  const mr = R + GLYPH / 2 + 10;

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ position: 'absolute', left: cx - ox, top: cy - oy, width: size, height: size }}
        accessibilityRole="adjustable"
        accessibilityLabel={`Frame shape, ${SHAPE_LABEL[value]}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const i = SHAPES.indexOf(value) + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          if (i >= 0 && i <= last) onChange(SHAPES[i]);
        }}>
        <View style={[s.marker, { left: ox + mr * Math.sin(SEL) - 3, top: oy - mr * Math.cos(SEL) - 3 }]} />
        {SHAPES.map((sh, i) => (
          <Item key={sh} i={i} sh={sh} pos={pos} R={R} ox={ox} oy={oy} onPress={() => onChange(sh)} />
        ))}
      </View>
    </GestureDetector>
  );
}

function Item({ i, sh, pos, R, ox, oy, onPress }: { i: number; sh: Shape; pos: SharedValue<number>; R: number; ox: number; oy: number; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = i - pos.value;
    const a = SEL + d * STEP;
    const far = Math.abs(d);
    // Shapes slide in along the track and shrink as they near its ends, so nothing pops in.
    const edge = Math.min(a - FROM, TO - a) / (14 * DEG);
    return {
      opacity: Math.min(Math.max(edge, 0), 1),
      transform: [
        { translateX: ox + R * Math.sin(a) - GLYPH / 2 },
        { translateY: oy - R * Math.cos(a) - GLYPH / 2 },
        { rotate: `${a - SEL}rad` },
        { scale: far < 1 ? 1.25 - far * 0.4 : Math.max(0.85 - (far - 1) * 0.1, 0.6) },
      ],
    };
  });
  return (
    <Animated.View style={[s.item, style]}>
      <Pressable onPress={onPress} hitSlop={6} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ShapeArt shape={sh} size={GLYPH} stroke={null} />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  item: { position: 'absolute', left: 0, top: 0 },
  marker: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: color.paper },
});
