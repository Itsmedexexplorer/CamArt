import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, interpolateColor, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, settle, space, themed, useTheme } from '@/theme';
import { Aperture, CalendarDots, GearSix, Sticker, type IconType } from '@/ui/icons';
import { Surface } from '@/ui/puffy';

const TABS: { path: '/' | '/memories' | '/calendar' | '/settings'; label: string; I: IconType; tint: string }[] = [
  { path: '/', label: 'Camera', I: Aperture, tint: color.cherry },
  { path: '/memories', label: 'Stickers', I: Sticker, tint: color.sun },
  { path: '/calendar', label: 'Calendar', I: CalendarDots, tint: color.cobalt },
  { path: '/settings', label: 'Settings', I: GearSix, tint: color.lime },
];

export const TAB_H = 64;
const PILL_H = 48;
/** Space a screen should leave at the bottom so content clears the floating bar. */
export const useTabSpace = () => useSafeAreaInsets().bottom + space.md + TAB_H + space.md;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const glide = LinearTransition.springify().damping(settle.damping).stiffness(settle.stiffness);

/**
 * Floating bar on a solid theme surface. One coloured capsule slides and stretches to the active
 * tab (changing colour on the way) while the tabs themselves glide to make room for its label.
 */
export function TabBar() {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const active = TABS.findIndex((t) => (t.path === '/' ? path === '/' : path.startsWith(t.path)));
  const [slots, setSlots] = useState<({ x: number; w: number } | undefined)[]>([]);

  const x = useSharedValue(0), w = useSharedValue(0), tint = useSharedValue(Math.max(active, 0));
  const placed = useRef(false);
  useEffect(() => {
    const slot = slots[active];
    if (!slot) return;
    if (!placed.current) {
      // First layout: put the capsule in place without animating from nowhere.
      x.set(slot.x);
      w.set(slot.w);
      tint.set(active);
      placed.current = true;
      return;
    }
    x.set(withSpring(slot.x, settle));
    w.set(withSpring(slot.w, settle));
    tint.set(withTiming(active, { duration: 260 }));
  }, [active, slots, x, w, tint]);
  const capsule = useAnimatedStyle(() => ({
    width: w.value,
    transform: [{ translateX: x.value }],
    backgroundColor: interpolateColor(tint.value, TABS.map((_, i) => i), TABS.map((t) => t.tint)),
  }));

  return (
    <View style={[s.wrap, { bottom: insets.bottom + space.md }]} pointerEvents="box-none">
      <Surface style={s.bar}>
        {active >= 0 && slots[active] && <Animated.View style={[s.capsule, capsule]} pointerEvents="none" />}
        {TABS.map((tab, i) => {
          const on = i === active;
          return (
            <AnimatedPressable key={tab.path} layout={glide} onPress={() => on || router.navigate(tab.path)}
              onLayout={(e) => {
                const { x: lx, width } = e.nativeEvent.layout;
                setSlots((prev) => (prev[i]?.x === lx && prev[i]?.w === width ? prev : Object.assign([...prev], { [i]: { x: lx, w: width } })));
              }}
              accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }} style={s.hit}>
              <View style={[s.item, on && s.itemOn]}>
                <tab.I size={on ? 26 : 27} weight="fill" color={on ? c.onAccent : c.inkSoft} />
                {on && <Animated.Text entering={FadeIn.duration(200).delay(60)} style={s.label} numberOfLines={1}>{tab.label}</Animated.Text>}
              </View>
            </AnimatedPressable>
          );
        })}
      </Surface>
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    height: TAB_H, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: TAB_H / 2,
  },
  hit: { height: TAB_H, justifyContent: 'center' },
  item: { height: PILL_H, minWidth: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  itemOn: { paddingHorizontal: space.lg },
  capsule: { position: 'absolute', left: 0, top: (TAB_H - PILL_H) / 2, height: PILL_H, borderRadius: PILL_H / 2 },
  label: { fontFamily: font.display, fontSize: 17, letterSpacing: -0.3, color: c.onAccent },
}));
