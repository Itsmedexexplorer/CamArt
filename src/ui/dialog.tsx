import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { radius, settle, space, themed, useTheme } from '@/theme';
import { Warning, type IconType } from '@/ui/icons';
import { Button } from '@/ui/puffy';

type Action = { label: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type Dialog = { title: string; body?: string; icon?: IconType; actions: Action[] };

// One dialog at a time, shown by <DialogHost /> in the root layout. Same shape as Alert.alert.
let current: Dialog | null = null;
const subs = new Set<() => void>();
const set = (d: Dialog | null) => ((current = d), subs.forEach((f) => f()));

/** In-app replacement for Alert.alert, styled like the rest of CamArt. */
export function ask(title: string, body?: string, actions: Action[] = [{ label: 'OK' }], icon?: IconType) {
  if (actions.some((a) => a.style === 'destructive')) haptic.select();
  set({ title, body, actions, icon });
}

/** A "something went wrong" message with a single OK. */
export const oops = (title: string, e: unknown, fallback = 'Try again.') => {
  haptic.error();
  ask(title, e instanceof Error ? e.message : fallback, [{ label: 'OK' }], Warning);
};

export function DialogHost() {
  const d = useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => current);
  const { c, ty } = useTheme();
  const s = useStyles();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  if (!d) return null;

  const cancel = d.actions.find((a) => a.style === 'cancel');
  const close = (a?: Action) => {
    set(null);
    a?.onPress?.();
  };
  const danger = d.actions.some((a) => a.style === 'destructive');
  const I = d.icon;

  const ordered = [...d.actions].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel')); // safe way out on the left

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close(cancel)}>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => cancel && close(cancel)} accessibilityLabel="Dismiss" />
        {/* Same sheet as the editor's panels: rises from the bottom, rounded top, grab handle. */}
        <Animated.View entering={reduce ? undefined : SlideInDown.springify().damping(settle.damping).stiffness(settle.stiffness)}
          style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal accessibilityRole="alert">
          <View style={s.handle} />
          <View style={s.head}>
            {I && (
              <View style={[s.badge, { backgroundColor: danger ? c.cherry : c.sun }]}>
                <I size={24} weight="fill" color={danger ? '#FFFFFF' : c.onAccent} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[ty.title, { fontSize: 22, lineHeight: 26 }]}>{d.title}</Text>
              {d.body ? <Text style={ty.meta}>{d.body}</Text> : null}
            </View>
          </View>
          <View style={s.actions}>
            {ordered.map((a) => (
              <Button key={a.label} label={a.label} onPress={() => close(a)} style={{ flex: 1 }}
                tone={a.style === 'destructive' ? 'cherry' : a.style === 'cancel' ? 'soft' : 'ink'} />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const useStyles = themed((c) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(10,12,18,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.lg },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm },
}));
