import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { deleteMemory, fileOf, stickerPng, useMemories } from '@/lib/memories';
import { EDGES, FILTER_LABEL, SHAPE_LABEL, type Edge, type Filter, type Shape } from '@/lib/sticker';
import { font, radius, space, themed, useTheme, settle } from '@/theme';
import { Backdrop } from '@/ui/backdrop';
import { useTilt } from '@/ui/tilt';
import { Check, Copy, Share, Trash } from '@/ui/icons';
import { Button, Empty, Sticker } from '@/ui/puffy';
import { ask, oops } from '@/ui/dialog';

export default function MemoryScreen() {
  const { c, ty } = useTheme();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useMemories().find((x) => x.id === id);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [gone, setGone] = useState(false);
  const [copied, setCopied] = useState(false);
  const tiltStyle = useTilt();

  if (!m) return <Empty title="Memory not found" body="It may have been deleted." />;
  const d = new Date(m.createdAt);
  const missing = !fileOf(m.rendered).exists;
  const edge = (m.edge ?? 'paper') as Edge;

  const share = async () => {
    try {
      const { file } = await stickerPng(m);
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share sticker' });
    } catch (e) {
      oops('Could not share', e, 'Try again.');
    }
  };

  const copy = async () => {
    try {
      await Clipboard.setImageAsync((await stickerPng(m)).base64);
      setCopied(true);
      haptic.success();
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      oops('Could not copy', e, 'Try again.');
    }
  };

  const remove = () =>
    ask('Delete this memory?', 'The sticker and its original photo will be removed from this device.', [
      { label: 'Keep it', style: 'cancel' },
      {
        label: 'Delete',
        style: 'destructive',
        onPress: () => {
          setGone(true);
          haptic.delete();
          setTimeout(() => (router.back(), deleteMemory(m.id)), 220);
        },
      },
    ], Trash);

  const chips = [SHAPE_LABEL[m.shape as Shape] ?? m.shape, FILTER_LABEL[m.filter as Filter] ?? m.filter, d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })];

  return (
    <View style={{ flex: 1, backgroundColor: c.milk }}>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <Backdrop tint={edge === 'paper' || edge === 'ink' ? c.sand : EDGES[edge]} width={width} height={height} />
      <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 110 }]}>
        <View>
          <Text style={ty.label}>{d.toLocaleDateString(undefined, { weekday: 'long' })}</Text>
          <Text style={ty.hero}>{d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</Text>
        </View>
        {!gone && (
          <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(settle.damping).stiffness(settle.stiffness)} exiting={FadeOut.duration(200)} style={{ alignItems: 'center' }}>
            {missing ? (
              <Empty title="Sticker file is missing" body="Restore a backup to bring it back." />
            ) : (
              <Animated.View style={tiltStyle}>
                <Sticker m={m} size={width - space.lg * 2} angle={-2} />
              </Animated.View>
            )}
          </Animated.View>
        )}
        {m.caption ? <Text style={[ty.title, { textAlign: 'center' }]}>“{m.caption}”</Text> : null}
        <View style={s.chips}>
          {chips.map((c) => (
            <View key={c} style={s.chip}>
              <Text style={s.chipText}>{c}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + space.md }]}>
        {copied && (
          <Animated.View entering={reduce ? undefined : ZoomIn.duration(180)} style={s.toast}>
            <Check size={16} color={c.onAccent} weight="bold" />
            <Text style={[s.chipText, { color: c.onAccent }]}>Copied. Paste it into any chat.</Text>
          </Animated.View>
        )}
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Button label="Share sticker" icon={Share} tone="cherry" onPress={share} disabled={missing} style={{ flex: 1 }} />
          <Button icon={Copy} a11y="Copy sticker" onPress={copy} disabled={missing} round />
          <Button icon={Trash} a11y="Delete memory" onPress={remove} round />
        </View>
      </View>
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  body: { paddingHorizontal: space.lg, gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  chip: { paddingHorizontal: space.md, height: 34, borderRadius: 17, backgroundColor: c.paper, justifyContent: 'center' },
  chipText: { fontFamily: font.uiBold, fontSize: 13, color: c.ink },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  toast: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.lime, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm },
}));
