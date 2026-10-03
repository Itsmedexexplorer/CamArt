import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, space, themed, useTheme } from '@/theme';
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

/** Floating bar on a solid theme surface. The active tab blooms into a coloured pill drawn with Skia. */
export function TabBar() {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  return (
    <View style={[s.wrap, { bottom: insets.bottom + space.md }]} pointerEvents="box-none">
      <Surface style={s.bar}>
        {TABS.map((tab) => {
          const on = tab.path === '/' ? path === '/' : path.startsWith(tab.path);
          return (
            <Pressable key={tab.path} onPress={() => on || router.navigate(tab.path)} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }} style={s.hit}>
              {on ? (
                <Pill tint={tab.tint} I={tab.I} label={tab.label} />
              ) : (
                <View style={s.item}>
                  <tab.I size={27} weight="fill" color={c.inkSoft} />
                </View>
              )}
            </Pressable>
          );
        })}
      </Surface>
    </View>
  );
}

function Pill({ tint, I, label }: { tint: string; I: IconType; label: string }) {
  const { c } = useTheme();
  const s = useStyles();
  const [w, setW] = useState(0);
  return (
    <View style={[s.item, s.pill]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {w > 0 && <RoundedRect x={0} y={0} width={w} height={PILL_H} r={PILL_H / 2} color={tint} />}
      </Canvas>
      <I size={26} weight="fill" color={c.onAccent} />
      <Text style={s.label}>{label}</Text>
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
  pill: { paddingHorizontal: space.lg },
  label: { fontFamily: font.display, fontSize: 17, letterSpacing: -0.3, color: c.onAccent },
}));
