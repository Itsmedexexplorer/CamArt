import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import type { ReactNode, RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import { uriOf, type Memory } from '@/lib/memories';
import type { Shape } from '@/lib/sticker';
import { font, hit, lift, motion, radius, space, themed, useTheme, type Palette, settle } from '@/theme';
import type { IconType } from '@/ui/icons';
import { ShapeArt } from '@/ui/shape-art';

type Tone = 'cherry' | 'ink' | 'soft' | 'glass' | 'glassDark';
const tones = (c: Palette) => ({
  bg: { cherry: c.cherry, ink: c.ink, soft: c.wash, glass: 'transparent', glassDark: 'transparent' } as Record<Tone, string>,
  fg: { cherry: '#FFFFFF', ink: c.milk, soft: c.ink, glass: c.ink, glassDark: '#FFFFFF' } as Record<Tone, string>,
});

/** Press physics shared by every tactile surface: a quick squeeze to 0.96. */
function usePress() {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const style = useAnimatedStyle(() => (reduce ? { opacity: 1 - p.value * 0.2 } : { transform: [{ scale: 1 - p.value * 0.04 }] }));
  return {
    style,
    handlers: { onPressIn: () => p.set(withTiming(1, { duration: motion.press })), onPressOut: () => p.set(withSpring(0, settle)) }, // springs back smoothly
  };
}

/** Frosted surface. Real blur on iOS; on Android real blur needs a `target` (a BlurTargetView ref), else a milky tint. */
// Liquid-glass sheen: a bright specular band at the top fading out, and a faint bounce light at the bottom.
const SHEEN_SMOKED = 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.07) 100%)';
const SHEEN_FROST = 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.25) 100%)';

export function Glass({ children, style, dark, target }: { children?: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean; target?: RefObject<View | null> }) {
  // One glass for the whole app. "Smoked" (navbar, camera controls, anything in dark mode) or "frost".
  const { scheme } = useTheme();
  const smoked = dark || scheme === 'dark';
  return (
    <BlurView
      intensity={smoked ? 50 : 60}
      tint={smoked ? 'dark' : 'light'}
      blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
      blurTarget={target}
      style={[
        { overflow: 'hidden', backgroundColor: smoked ? 'rgba(20,24,36,0.36)' : 'rgba(248,247,242,0.42)' },
        // Rim: brighter on top where light catches the edge, softer around.
        {
          borderWidth: 1,
          borderColor: smoked ? 'rgba(255,255,255,0.16)' : 'rgba(24,32,51,0.08)',
          borderTopColor: smoked ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.95)',
        },
        style,
      ]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { experimental_backgroundImage: smoked ? SHEEN_SMOKED : SHEEN_FROST }]} />
      {children}
    </BlurView>
  );
}

export function Button({
  label, icon: I, onPress, tone = 'soft', disabled, round, a11y, style, target,
}: {
  label?: string; icon?: IconType; onPress: () => void; tone?: Tone; disabled?: boolean; round?: boolean; a11y?: string; style?: StyleProp<ViewStyle>;
  target?: RefObject<View | null>; // what a glass button blurs (Android needs it for real blur)
}) {
  const { bg, fg } = tones(useTheme().c);
  const s = useStyles();
  const { style: pressStyle, handlers } = usePress();
  const glass = tone === 'glass' || tone === 'glassDark';
  const content = (
    <>
      {I && <I size={22} color={fg[tone]} weight={round ? 'bold' : 'fill'} />}
      {label && <Text style={[s.label, { color: fg[tone] }]}>{label}</Text>}
    </>
  );
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled }}
      style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
      <Animated.View style={[(tone === 'cherry' || tone === 'ink') && lift, pressStyle]}>
        {glass ? (
          <Glass dark={tone === 'glassDark'} target={target} style={[s.face, round && s.round]}>{content}</Glass>
        ) : (
          <View style={[s.face, round && s.round, { backgroundColor: bg[tone] }]}>{content}</View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function Chip({ selected, onPress, label, a11y, children }: { selected: boolean; onPress: () => void; label?: string; a11y?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const s = useStyles();
  const { style, handlers } = usePress();
  return (
    <Pressable {...handlers} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ selected }} hitSlop={4}>
      <Animated.View style={[s.chip, selected && s.chipOn, style]}>
        {children}
        {label && <Text style={[s.chipText, selected && { color: c.milk }]}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
}

/** Deterministic tilt per memory, -9..9°, so the board looks hand-placed but stays stable. */
export const tilt = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 19) - 9;
};

/** A saved, rendered sticker. Never shows the raw original. */
export function Sticker({ m, size, angle }: { m: Memory; size: number; angle?: number }) {
  return (
    <Image
      source={{ uri: uriOf(m.rendered) }}
      style={{ width: size, height: size, transform: [{ rotate: `${angle ?? tilt(m.id)}deg` }] }}
      contentFit="contain"
      recyclingKey={m.id}
      accessibilityLabel={m.caption ? `Sticker: ${m.caption}` : 'Sticker memory'}
    />
  );
}

const EMPTY_ART: { sh: Shape; x: number; r: number }[] = [
  { sh: 'stamp', x: -46, r: -10 },
  { sh: 'clover', x: 0, r: 6 },
  { sh: 'heart', x: 46, r: 12 },
];

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const { c, ty } = useTheme();
  const s = useStyles();
  const reduce = useReducedMotion();
  return (
    <View style={s.empty}>
      {/* Three stickers placed one after another: a quiet, one-time entrance. */}
      <View style={{ height: 76, width: 160 }}>
        {EMPTY_ART.map((a, i) => (
          <Animated.View key={a.sh} entering={reduce ? undefined : ZoomIn.springify().damping(settle.damping).stiffness(settle.stiffness).delay(120 + i * 110)}
            style={{ position: 'absolute', left: 50 + a.x, top: i === 1 ? 0 : 12, transform: [{ rotate: `${a.r}deg` }] }}>
            <ShapeArt shape={a.sh} size={60} stroke={null} />
          </Animated.View>
        ))}
      </View>
      <Text style={[ty.title, { textAlign: 'center', fontSize: 30, lineHeight: 34 }]}>{title}</Text>
      <Text style={[ty.body, { color: c.inkSoft, textAlign: 'center' }]}>{body}</Text>
      {action}
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  face: { minHeight: hit + 8, paddingHorizontal: space.xl, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  round: { width: hit + 4, minHeight: hit + 4, paddingHorizontal: 0 },
  label: { fontFamily: font.uiBold, fontSize: 16 },
  chip: { minHeight: hit, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: c.wash, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  chipOn: { backgroundColor: c.ink },
  chipText: { fontFamily: font.uiBold, fontSize: 13, color: c.ink },
  empty: { alignItems: 'center', gap: space.md, padding: space.xxl, paddingTop: 72 },
}));
