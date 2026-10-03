import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabSpace } from '@/ui/tab-bar';

import { haptic } from '@/lib/haptics';
import { byDay, exportBackup, restoreBackup, storageBytes, uriOf, useMemories, type RestoreResult } from '@/lib/memories';
import { hasNative, sendToWhatsApp } from '@/lib/native';
import { setSettings, useSettings, type Appearance } from '@/lib/settings';
import { font, hit, radius, space, themed, useTheme } from '@/theme';
import { Archive, Check, Doc, Info, Lock, Moon, Share, Motion, Next, Restore, Shield, Storage, Vibrate, type IconType } from '@/ui/icons';
import { Loader } from '@/ui/loader';
import { Button } from '@/ui/puffy';

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'done'; r: RestoreResult } | { kind: 'error'; text: string; retry: () => void };

export default function Settings() {
  const { c, ty } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabSpace();
  const settings = useSettings();
  const memories = useMemories();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';
  const [pack, setPack] = useState<{ busy?: boolean; text?: string; ok?: boolean }>({});

  async function addPack() {
    if (memories.length < 3) return setPack({ text: `Make ${3 - memories.length} more ${memories.length === 2 ? 'sticker' : 'stickers'} first: WhatsApp packs need at least 3.` });
    setPack({ busy: true, text: 'Preparing your pack…' });
    try {
      const r = await sendToWhatsApp(memories.map((m) => uriOf(m.rendered)));
      if (r === 'added') haptic.success();
      setPack(r === 'added' ? { ok: true, text: 'Added. Find it in WhatsApp under Stickers → CamArt.' } : { text: 'Not added. Tap again whenever you’re ready.' });
    } catch (e) {
      haptic.error();
      setPack({ text: e instanceof Error ? e.message : 'Could not create the pack.' });
    }
  }

  async function backup() {
    setStatus({ kind: 'busy', text: 'Packing your stickers…' });
    try {
      await exportBackup();
      setStatus({ kind: 'idle' });
    } catch (e) {
      haptic.error();
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Backup failed.', retry: backup });
    }
  }

  async function restore() {
    const pick = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], copyToCacheDirectory: true });
    if (pick.canceled) return;
    const uri = pick.assets[0].uri;
    const run = async () => {
      try {
        const r = await restoreBackup(uri, (text) => setStatus({ kind: 'busy', text }));
        setStatus({ kind: 'done', r });
        haptic.success();
      } catch (e) {
        haptic.error();
        setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Restore failed.', retry: run });
      }
    };
    run();
  }

  const setHaptics = (v: boolean) => {
    setSettings({ haptics: v });
    haptic.success(); // a tap you can feel confirms it works (silent when just turned off)
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: tabSpace, gap: space.xl }}>
      <View>
        <Text style={ty.label}>Make it yours</Text>
        <Text style={ty.hero}>Settings</Text>
      </View>

      {/* Collection at a glance */}
      <View style={s.statRow}>
        <Stat n={memories.length} label="memories" tint={c.sun} />
        <Stat n={byDay(memories).size} label="days" tint={c.mint} />
        <Stat n={(storageBytes() / 1e6).toFixed(1)} label="MB" tint={c.lilac} />
      </View>

      {/* Backup */}
      <View style={[s.card, { backgroundColor: c.sand, gap: space.md }]}>
        <View style={s.cardHead}>
          <Badge I={Archive} tint={c.sun} />
          <View style={{ flex: 1 }}>
            <Text style={ty.title}>Keep a copy</Text>
            <Text style={ty.meta}>A ZIP with every sticker, original photo and note.</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Back up" icon={Archive} tone="ink" onPress={backup} disabled={busy || !memories.length} style={{ flex: 1 }} />
          <Button label="Restore" icon={Restore} tone="soft" onPress={restore} disabled={busy} style={{ flex: 1 }} />
        </View>
        {status.kind === 'busy' && (
          <View style={s.status} accessibilityLiveRegion="polite">
            <Loader size={28} />
            <Text style={ty.body}>{status.text}</Text>
          </View>
        )}
        {status.kind === 'done' && (
          <View style={[s.status, { backgroundColor: c.lime }]} accessibilityLiveRegion="polite">
            <Check size={20} color={c.onAccent} weight="bold" />
            <Text style={[ty.body, { flex: 1, color: c.onAccent }]}>
              {status.r.added ? `Restored ${status.r.added} ${status.r.added === 1 ? 'memory' : 'memories'}.` : 'Nothing new to restore.'}
              {status.r.duplicates ? ` ${status.r.duplicates} already here.` : ''}
              {status.r.invalid ? ` ${status.r.invalid} damaged and skipped.` : ''}
            </Text>
          </View>
        )}
        {status.kind === 'error' && (
          <View style={[s.status, { backgroundColor: '#FFE1DE' }]} accessibilityLiveRegion="assertive">
            <Text style={[ty.body, { flex: 1 }]}>{status.text}</Text>
            <Button label="Retry" tone="cherry" onPress={status.retry} />
          </View>
        )}
      </View>

      {hasNative && (
        <View style={[s.card, { backgroundColor: c.mint, gap: space.md }]}>
          <View style={s.cardHead}>
            <Badge I={Share} tint="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={[ty.title, { color: c.onAccent }]}>Sticker pack</Text>
              <Text style={[ty.meta, { color: c.onAccent }]}>Your 30 newest stickers become one “CamArt” pack in WhatsApp. Made more? Tap again to refresh it.</Text>
            </View>
          </View>
          <Button label={pack.busy ? 'Preparing…' : 'Add to WhatsApp'} tone="ink" disabled={pack.busy} onPress={addPack} />
          {pack.text && (
            <View style={[s.status, pack.ok && { backgroundColor: c.lime }]} accessibilityLiveRegion="polite">
              {pack.busy ? <Loader size={24} /> : pack.ok ? <Check size={20} color={c.onAccent} weight="bold" /> : null}
              <Text style={[ty.body, { flex: 1 }, pack.ok && { color: c.onAccent }]}>{pack.text}</Text>
            </View>
          )}
        </View>
      )}

      <Group title="Look">
        <Row I={Moon} tint={c.lilac} title="Appearance" sub="Light, dark, or follow your phone" />
        <View style={s.seg}>
          {(['system', 'light', 'dark'] as Appearance[]).map((a) => {
            const on = settings.appearance === a;
            return (
              <Pressable key={a} onPress={() => (on || (setSettings({ appearance: a }), haptic.select()))} accessibilityRole="button" accessibilityState={{ selected: on }}
                accessibilityLabel={`Appearance ${a}`} style={[s.segItem, on && s.segOn]}>
                <Text style={[s.segText, on && s.segTextOn]}>{a === 'system' ? 'System' : a === 'light' ? 'Light' : 'Dark'}</Text>
              </Pressable>
            );
          })}
        </View>
      </Group>

      <Group title="Feel">
        <Row I={Vibrate} tint={c.gum} title="Haptics" sub="Tiny taps when you pick, save or restore">
          <Switch value={settings.haptics} onValueChange={setHaptics} trackColor={{ true: c.ink, false: c.line }} thumbColor={c.paper} accessibilityLabel="Haptics" />
        </Row>
        <Row I={Motion} tint={c.mint} title="Motion" sub="Follows your system Reduce Motion setting" />
      </Group>

      <View style={[s.card, { backgroundColor: c.onAccent, flexDirection: 'row', gap: space.md, alignItems: 'center' }]}>
        <Lock size={28} color={c.lime} weight="fill" />
        <Text style={[ty.body, { color: '#F3F1EA', flex: 1 }]}>Your photos stay on this device unless you choose to export or share them.</Text>
      </View>

      <Group title="CamArt">
        {(
          [
            ['privacy', 'Privacy Policy', Shield, c.lime],
            ['terms', 'Terms', Doc, c.sun],
            ['about', 'About', Info, c.lilac],
          ] as const
        ).map(([page, title, I, tint]) => (
          <Pressable key={page} onPress={() => router.push({ pathname: '/info', params: { page } })} accessibilityRole="link">
            <Row I={I} tint={tint} title={title}>
              <Next size={18} color={c.inkSoft} weight="bold" />
            </Row>
          </Pressable>
        ))}
      </Group>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <Storage size={18} color={c.inkSoft} />
        <Text style={ty.meta}>No account. No cloud. No tracking.</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ n, label, tint }: { n: number | string; label: string; tint: string }) {
  const s = useStyles();
  return (
    <View style={[s.stat, { backgroundColor: tint }]}>
      <Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>{n}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ I, tint }: { I: IconType; tint: string }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <View style={[s.badge, { backgroundColor: tint }]}>
      <I size={22} color={c.onAccent} weight="fill" />
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { ty } = useTheme();
  const s = useStyles();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={ty.label}>{title}</Text>
      <View style={s.group}>{children}</View>
    </View>
  );
}

function Row({ I, tint, title, sub, children }: { I: IconType; tint: string; title: string; sub?: string; children?: ReactNode }) {
  const { ty } = useTheme();
  const s = useStyles();
  return (
    <View style={s.row}>
      <Badge I={I} tint={tint} />
      <View style={{ flex: 1 }}>
        <Text style={ty.strong}>{title}</Text>
        {sub && <Text style={ty.meta}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  seg: { flexDirection: 'row', margin: space.md, marginTop: 0, padding: 4, borderRadius: 22, backgroundColor: c.wash },
  segItem: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: c.ink },
  segText: { fontFamily: font.uiBold, fontSize: 14, color: c.ink },
  segTextOn: { color: c.milk },
  statRow: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderRadius: radius.lg, padding: space.lg, gap: 2 },
  statNum: { fontFamily: font.display, fontSize: 32, lineHeight: 36, color: c.onAccent, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: font.uiBold, fontSize: 13, color: c.onAccent },
  card: { borderRadius: radius.lg, padding: space.lg },
  cardHead: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  badge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.paper },
  group: { borderRadius: radius.lg, backgroundColor: c.paper, paddingVertical: space.xs },
  row: { minHeight: hit + 20, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
}));
