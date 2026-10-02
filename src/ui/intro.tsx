import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { LOGO, logoParts } from '@/lib/logo';
import { font, settle } from '@/theme';

/**
 * Opening moment, once per launch: the blossom unfurls and turns into place, the lens opens at
 * its heart and catches a glint, the wordmark rises, then everything lifts away. ~1.8s.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.62, 280);
  const parts = useMemo(() => logoParts(size, 0.86), [size]);
  const reduce = useReducedMotion();
  const bloom = useSharedValue(0);
  const lens = useSharedValue(0);
  const word = useSharedValue(0);
  const out = useSharedValue(0);

  useEffect(() => {
    const finish = (done?: boolean) => {
      'worklet';
      if (done) scheduleOnRN(onDone);
    };
    if (reduce) {
      bloom.set(1);
      lens.set(1);
      word.set(1);
      out.set(withDelay(700, withTiming(1, { duration: 300 }, finish)));
      return;
    }
    bloom.set(withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }));
    lens.set(withDelay(420, withSpring(1, settle)));
    word.set(withDelay(620, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
    out.set(withDelay(1450, withTiming(1, { duration: 380, easing: Easing.inOut(Easing.cubic) }, finish)));
  }, [reduce, bloom, lens, word, out, onDone]);

  const bloomT = useDerivedValue(() => [{ rotate: ((1 - bloom.value) * -120 * Math.PI) / 180 }, { scale: 0.55 + 0.45 * bloom.value }]);
  const bloomO = useDerivedValue(() => Math.min(bloom.value * 2, 1));
  const lensT = useDerivedValue(() => [{ scale: lens.value }]);
  const glintO = useDerivedValue(() => Math.max(lens.value - 0.6, 0) / 0.4);
  const wrap = useAnimatedStyle(() => ({ opacity: 1 - out.value, transform: [{ scale: 1 + out.value * 0.06 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 14 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.bg, wrap]} pointerEvents="none">
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          <Group origin={parts.center} transform={bloomT} opacity={bloomO}>
            <Path path={parts.blossom} color={LOGO.edge} style="stroke" strokeWidth={parts.edgeWidth * 2} strokeJoin="round" />
            <Path path={parts.blossom} color={LOGO.petal} />
          </Group>
          <Group origin={parts.center} transform={lensT}>
            <Path path={parts.ring} color={LOGO.ring} />
            <Path path={parts.lens} color={LOGO.lens} />
            <Path path={parts.glint} color={LOGO.glint} opacity={glintO} />
          </Group>
        </Canvas>
      </View>
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, wordStyle]}>
        <Text style={s.word}>CamArt</Text>
        <Text style={s.tag}>tiny daily stickers</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bg: { backgroundColor: LOGO.bg, alignItems: 'center', justifyContent: 'center', gap: 18 },
  word: { fontFamily: font.display, fontSize: 46, letterSpacing: -1.6, color: LOGO.lens },
  tag: { fontFamily: font.uiBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(24,32,51,0.6)' },
});
