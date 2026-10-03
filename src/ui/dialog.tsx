import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, ZoomIn } from 'react-native-reanimated';

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
  if (!d) return null;

  const cancel = d.actions.find((a) => a.style === 'cancel');
  const close = (a?: Action) => {
    set(null);
    a?.onPress?.();
  };
  const danger = d.actions.some((a) => a.style === 'destructive');
  const I = d.icon;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close(cancel)}>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => cancel && close(cancel)} accessibilityLabel="Dismiss" />
        <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(settle.damping).stiffness(settle.stiffness)} style={s.card} accessibilityViewIsModal accessibilityRole="alert">
          {I && (
            <View style={[s.badge, { backgroundColor: danger ? c.cherry : c.sun }]}>
              <I size={26} weight="fill" color={danger ? '#FFFFFF' : c.onAccent} />
            </View>
          )}
          <Text style={[ty.title, { textAlign: 'center' }]}>{d.title}</Text>
          {d.body ? <Text style={[ty.body, { color: c.inkSoft, textAlign: 'center' }]}>{d.body}</Text> : null}
          <View style={s.actions}>
            {/* Main action first, the safe way out underneath. */}
            {[...d.actions].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel')).map((a) => (
              <Button key={a.label} label={a.label} onPress={() => close(a)}
                tone={a.style === 'destructive' ? 'cherry' : a.style === 'cancel' ? 'soft' : 'ink'} />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const useStyles = themed((c) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(10,12,18,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 360, backgroundColor: c.paper, borderRadius: radius.lg, padding: space.xl, gap: space.md, alignItems: 'stretch' },
  badge: { alignSelf: 'center', width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  actions: { gap: space.sm, marginTop: space.sm },
}));
