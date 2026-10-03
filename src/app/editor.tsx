import { Canvas, ColorMatrix, createPicture, Group, Image as SkImg, Paint, Picture, RuntimeShader, Skia, useTypeface, type SkImage, type SkTypeface } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, PixelRatio, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { discardOriginal, saveMemory, uriOf } from '@/lib/memories';
import { hasNative, liftSubject } from '@/lib/native';
import {
  drawSticker, EDGES, EXPORT_VERSION, FILTER_LABEL, FILTER_MATRIX, FILTERS, GRAINS, loadCrop, renderSticker, S, SHAPE_EDGE, SHAPE_LABEL, SHAPES, stampText, textMetrics,
  type Edge, type Filter, type Look, type Shape, type TextItem, type TextSize,
} from '@/lib/sticker';
import { settle, font, lift, motion, radius, space, themed, useTheme } from '@/theme';
import { CalendarDots, Check, Close, Plus, Sparkle, Sticker, TextT, Trash } from '@/ui/icons';
import { Button, Chip } from '@/ui/puffy';
import { Backdrop } from '@/ui/backdrop';
import { Loader } from '@/ui/loader';
import { useTilt } from '@/ui/tilt';
import { ShapeArt } from '@/ui/shape-art';

type Panel = 'shape' | 'filter' | 'note' | 'write';
const GRAIN_LABEL = ['Off', 'Soft', 'Medium', 'Heavy'];
const THUMB = 64;

export default function Editor() {
  const { c, ty } = useTheme();
  const s = useStyles();
  const p = useLocalSearchParams<{ id: string; original: string; shape: Shape; cy: string; frac: string }>();
  const crop = useMemo(() => ({ cy: Number(p.cy), frac: Number(p.frac) }), [p.cy, p.frac]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const typeface = useTypeface(require('@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf'));

  const [photo, setPhoto] = useState<SkImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('shape');
  const [shape, setShape] = useState<Shape>(SHAPES.includes(p.shape) ? p.shape : 'stamp');
  const [edge, setEdge] = useState<Edge>(SHAPE_EDGE[shape]);
  const [filter, setFilter] = useState<Filter>('raw');
  // Subject lift (development build only): the subject itself becomes the sticker.
  const [lifted, setLifted] = useState<SkImage | null>(null);
  const [cutout, setCutout] = useState(false);
  const [lifting, setLifting] = useState(false);
  async function lift() {
    if (cutout) return;
    haptic.select();
    if (lifted) return setCutout(true);
    setLifting(true);
    try {
      setLifted(await loadCrop(await liftSubject(uriOf(p.original)), crop));
      setCutout(true);
    } catch (e) {
      haptic.error();
      Alert.alert('Could not lift the subject', e instanceof Error ? e.message : 'Try another photo.');
    } finally {
      setLifting(false);
    }
  }
  const [prevFilter, setPrevFilter] = useState<Filter | null>(null);
  const [grain, setGrain] = useState<number>(GRAINS[1]);
  const [caption, setCaption] = useState('');
  const [showDate, setShowDate] = useState(true);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [phase, setPhase] = useState<'edit' | 'saving' | 'saved'>('edit');
  const date = useMemo(() => new Date(), []);
  const saved = useRef(false);

  useEffect(() => {
    loadCrop(uriOf(p.original), crop).then(setPhoto, (e) => setError(e.message));
    // Any exit without saving (close, Android back) drops the kept original.
    return () => {
      if (!saved.current) discardOriginal(p.original);
    };
  }, [p.original, crop]);

  const size = Math.min(width - space.xl * 2, height * 0.42);
  const look: Look = { shape, edge, texts, cutout, filter, grain, caption, showDate, date };
  const picture = useMemo(
    () =>
      photo &&
      createPicture((c) => {
        c.scale(size / S, size / S);
        drawSticker(c, photo, { shape, edge, texts, cutout, filter, grain, caption, showDate, date }, typeface, lifted);
      }, Skia.XYWHRect(0, 0, size, size)),
    [photo, shape, edge, texts, cutout, lifted, filter, grain, caption, showDate, date, typeface, size],
  );
  // The outgoing look, drawn underneath while a filter change sweeps across.
  const prevPicture = useMemo(
    () =>
      photo &&
      prevFilter &&
      createPicture((c) => {
        c.scale(size / S, size / S);
        drawSticker(c, photo, { shape, edge, texts, cutout, filter: prevFilter, grain, caption, showDate, date }, typeface, lifted);
      }, Skia.XYWHRect(0, 0, size, size)),
    [photo, prevFilter, shape, edge, texts, cutout, lifted, grain, caption, showDate, date, typeface, size],
  );

  // Motion: one settle on open, quick fade on shape change, pull-in on save.
  const enter = useSharedValue(0);
  const fade = useSharedValue(1);
  // Filter change: the new look sweeps diagonally across the old one, cell by cell (~1.1s).
  const sweep = useSharedValue(1);
  const pd = PixelRatio.get(); // layer shaders work in device pixels
  const sweepU = useDerivedValue(() => ({ p: sweep.value, cell: (size / 24) * pd, res: [size * pd, size * pd] }));
  const pickFilter = (f: Filter) => {
    if (f === filter) return;
    haptic.select();
    if (reduce) return setFilter(f);
    setPrevFilter(filter);
    setFilter(f);
    sweep.set(0);
    sweep.set(withTiming(1.1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(setPrevFilter, null);
    }));
  };
  const pull = useSharedValue(0);
  const tiltStyle = useTilt();
  useEffect(() => {
    if (photo) enter.set(withTiming(1, { duration: motion.sheet, easing: Easing.out(Easing.cubic) }));
  }, [photo, enter]);
  useEffect(() => {
    fade.set(withSequence(withTiming(0.55, { duration: 0 }), withTiming(1, { duration: motion.select })));
  }, [shape, fade]);
  const stickerStyle = useAnimatedStyle(() => ({
    opacity: enter.value * fade.value,
    transform: reduce
      ? []
      : [{ translateY: (1 - enter.value) * 14 }, { rotate: `${(1 - enter.value) * -3}deg` }, { scale: (0.94 + enter.value * 0.06) * (1 - pull.value * 0.08) }],
  }));

  async function save() {
    if (!photo || phase !== 'edit') return;
    setPhase('saving');
    try {
      const png = renderSticker(photo, look, typeface, lifted);
      saveMemory(
        { id: p.id, createdAt: date.toISOString(), original: p.original, shape, edge, cutout, texts: texts.filter((t) => t.t.trim()), filter, grain, caption: caption.trim(), showDate, crop, exportVersion: EXPORT_VERSION },
        png,
      );
      saved.current = true;
      pull.set(withTiming(1, { duration: motion.sheet, easing: Easing.out(Easing.cubic) }));
      setPhase('saved');
      haptic.success();
      setTimeout(() => router.replace(`/memory/${p.id}`), 700);
    } catch (e) {
      setPhase('edit');
      haptic.error();
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    }
  }

  const close = () =>
    Alert.alert('Discard this photo?', 'It has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);

  const pick = <T,>(set: (v: T) => void, cur: T) => (v: T) => {
    if (v === cur) return;
    set(v);
    haptic.select();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[s.screen, { paddingTop: insets.top }]}>
      <Backdrop tint={edge === 'paper' || edge === 'ink' ? c.sand : EDGES[edge]} width={width} height={height} />
      <View style={s.header}>
        <Button round tone="surface" icon={Close} a11y="Discard photo" onPress={close} />
        <View style={{ alignItems: 'center' }}>
          <Text style={ty.label}>New sticker</Text>
          <Text style={[ty.title, { fontSize: 22, lineHeight: 26 }]}>{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <View style={s.stage}>
        {error ? (
          <Text style={[ty.body, { color: c.cherry, textAlign: 'center' }]}>{error}</Text>
        ) : !picture ? (
          <Loader size={56} />
        ) : (
          <Animated.View style={tiltStyle}>
          <Animated.View style={stickerStyle}>
            <Canvas style={{ width: size, height: size }} accessibilityLabel="Sticker preview">
              {prevPicture ? (
                <>
                  <Picture picture={prevPicture} />
                  <Group layer={<Paint><RuntimeShader source={SWEEP} uniforms={sweepU} /></Paint>}>
                    <Picture picture={picture} />
                  </Group>
                </>
              ) : (
                <Picture picture={picture} />
              )}
            </Canvas>
            {typeface &&
              texts.map((t) => (
                <TextHandle key={t.id} t={t} size={size} typeface={typeface} selected={t.id === active}
                  onSelect={() => (setActive(t.id), setPanel('write'))}
                  onMove={(x, y) => setTexts((all) => all.map((o) => (o.id === t.id ? { ...o, x, y } : o)))} />
              ))}
          </Animated.View>
          </Animated.View>
        )}
        {phase === 'saved' && (
          <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(settle.damping).stiffness(settle.stiffness)} style={s.savedTag} accessibilityLiveRegion="polite">
            <Check size={20} color={c.onAccent} weight="bold" />
            <Text style={s.savedText}>Stuck to {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </Animated.View>
        )}
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}>
        <View style={s.seg}>
          {PANELS.map(({ key, label, I }) => {
            const on = panel === key;
            return (
              <Pressable key={key} onPress={() => setPanel(key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[s.segItem, on && s.segOn]}>
                <I size={18} weight={on ? 'fill' : 'bold'} color={on ? c.milk : c.ink} />
                <Text style={[s.segText, on && { color: c.milk }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.panel}>
          {panel === 'shape' && (
            <View style={{ gap: space.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {hasNative && (
                  <Tile selected={cutout} label={lifting ? 'Lifting…' : 'Lift'} a11y="Lift the subject out as the sticker" onPress={lift}>
                    {lifting ? <Loader size={34} /> : <Sparkle size={30} weight="fill" color={cutout ? c.milk : c.cherry} />}
                  </Tile>
                )}
                {SHAPES.map((sh) => (
                  <Tile key={sh} selected={!cutout && sh === shape} label={SHAPE_LABEL[sh]} a11y={`${SHAPE_LABEL[sh]} shape`}
                    onPress={() => {
                      if (!cutout && sh === shape) return;
                      setCutout(false);
                      setShape(sh);
                      setEdge(SHAPE_EDGE[sh]);
                      haptic.select();
                    }}>
                    <ShapeArt shape={sh} size={38} stroke={SHAPE_EDGE[sh] === 'paper' ? c.ink : null} />
                  </Tile>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.rail, { alignItems: 'center' }]}>
                <Text style={[ty.label, { marginRight: space.xs }]}>Edge</Text>
                {(Object.keys(EDGES) as Edge[]).map((e) => (
                  <Pressable key={e} onPress={() => pick(setEdge, edge)(e)} accessibilityRole="button" accessibilityLabel={`${e} edge`}
                    accessibilityState={{ selected: e === edge }} hitSlop={6} style={[s.swatch, { backgroundColor: EDGES[e] }, e === edge && s.swatchOn]} />
                ))}
              </ScrollView>
            </View>
          )}

          {panel === 'filter' && (
            <View style={{ gap: space.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                {FILTERS.map((f) => (
                  <Tile key={f} selected={f === filter} label={FILTER_LABEL[f]} a11y={`${FILTER_LABEL[f]} filter`} onPress={() => pickFilter(f)} bare>
                    {photo && <FilterThumb photo={photo} f={f} />}
                  </Tile>
                ))}
              </ScrollView>
              <View style={s.row}>
                <Text style={ty.label}>Grain</Text>
                <View style={s.segSmall}>
                  {GRAINS.map((g, i) => (
                    <Pressable key={g} onPress={() => pick(setGrain, grain)(g)} accessibilityRole="button" accessibilityState={{ selected: g === grain }}
                      accessibilityLabel={`Grain ${GRAIN_LABEL[i]}`} style={[s.segSmallItem, g === grain && s.segOn]}>
                      <Text style={[s.segText, g === grain && { color: c.milk }]}>{GRAIN_LABEL[i]}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {panel === 'note' && (
            <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
              <TextInput value={caption} onChangeText={setCaption} placeholder="Add a tiny label" placeholderTextColor={c.inkSoft}
                maxLength={32} returnKeyType="done" style={s.input} accessibilityLabel="Sticker label" />
              <View style={[s.row, { paddingHorizontal: 0 }]}>
                <View>
                  <Text style={ty.strong}>Date stamp</Text>
                  <Text style={ty.meta}>{stampText(date)}</Text>
                </View>
                <Switch value={showDate} onValueChange={(v) => (setShowDate(v), haptic.select())} trackColor={{ true: c.ink, false: c.line }} thumbColor={c.paper} accessibilityLabel="Date stamp" />
              </View>
            </View>
          )}
          {panel === 'write' && <WritePanel texts={texts} setTexts={setTexts} active={active} setActive={setActive} />}
        </View>

        <View style={{ paddingHorizontal: space.lg }}>
          <Button label={phase === 'saving' ? 'Saving…' : phase === 'saved' ? 'Saved' : 'Save sticker'} icon={phase === 'saved' ? Check : undefined} tone="cherry" onPress={save} disabled={!photo || phase !== 'edit'} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Reveals `image` cell by cell as p goes 0 → 1.1: a diagonal sweep with a little grain in its edge.
// Only the cells right at the moving edge are mosaic; everything behind it is crisp.
const SWEEP = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float p;
uniform float cell;
uniform float2 res;
float hash(float2 v) { return fract(sin(dot(v, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float2 c = floor(xy / cell);
  float2 uv = (c + 0.5) * cell / res;
  float th = (uv.x * 0.4 + uv.y * 0.6) * 0.82 + hash(c) * 0.18;
  float k = smoothstep(th - 0.07, th + 0.07, p);
  if (k <= 0.001) return half4(0.0);
  float front = 1.0 - abs(k * 2.0 - 1.0);
  half4 col = front > 0.2 ? image.eval((c + 0.5) * cell) : image.eval(xy);
  return col * k;
}`)!;

const PANELS = [
  { key: 'shape', label: 'Shape', I: Sticker },
  { key: 'filter', label: 'Filter', I: Sparkle },
  { key: 'note', label: 'Label', I: CalendarDots },
  { key: 'write', label: 'Text', I: TextT },
] as const;

function Tile({ selected, label, a11y, onPress, bare, children }: { selected: boolean; label: string; a11y: string; onPress: () => void; bare?: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected }} style={s.tile}>
      <View style={[s.tileFace, bare && s.tileBare, selected && (bare ? s.tileBareOn : s.tileOn)]}>{children}</View>
      <Text style={[s.tileText, selected && { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function FilterThumb({ photo, f }: { photo: SkImage; f: Filter }) {
  const clip = useMemo(() => Skia.RRectXY(Skia.XYWHRect(0, 0, THUMB, THUMB), 16, 16), []);
  return (
    <Canvas style={{ width: THUMB, height: THUMB }}>
      <Group clip={clip}>
        <SkImg image={photo} x={0} y={0} width={THUMB} height={THUMB} fit="cover">
          <ColorMatrix matrix={FILTER_MATRIX[f]} />
        </SkImg>
      </Group>
    </Canvas>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.milk },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  savedTag: {
    position: 'absolute', bottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs,
    backgroundColor: c.lime, borderRadius: 22, paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  savedText: { fontFamily: font.display, fontSize: 18, color: c.onAccent },
  sheet: { backgroundColor: c.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space.lg, gap: space.md, ...lift },
  seg: { flexDirection: 'row', marginHorizontal: space.lg, padding: 4, borderRadius: 22, backgroundColor: c.wash },
  segItem: { flex: 1, height: 40, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segOn: { backgroundColor: c.ink },
  segText: { fontFamily: font.uiBold, fontSize: 13, color: c.ink },
  segSmall: { flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: c.wash },
  segSmallItem: { height: 34, paddingHorizontal: space.md, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  panel: { minHeight: 142, justifyContent: 'center' },
  tile: { alignItems: 'center', gap: 6, width: 70 },
  tileFace: { width: 64, height: 64, borderRadius: 20, backgroundColor: c.wash, alignItems: 'center', justifyContent: 'center' },
  tileOn: { backgroundColor: c.ink },
  tileBare: { backgroundColor: 'transparent', borderWidth: 3, borderColor: 'transparent', width: 70, height: 70, borderRadius: 22 },
  tileBareOn: { borderColor: c.ink },
  tileText: { fontFamily: font.uiBold, fontSize: 12, color: c.inkSoft },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.line },
  handleOn: { borderWidth: 2, borderColor: c.paper, borderStyle: 'dashed' },
  swatchOn: { borderColor: c.ink, borderWidth: 3, transform: [{ scale: 1.12 }] },
  rail: { paddingHorizontal: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, gap: space.md },
  input: {
    minHeight: 52, borderRadius: radius.md, backgroundColor: c.wash,
    paddingHorizontal: space.lg, fontFamily: font.uiMedium, fontSize: 17, color: c.ink,
  },
}));

const SIZES: TextSize[] = ['s', 'm', 'l'];

/** Write anything, anywhere: add text items, edit the selected one, recolour, resize, delete. */
function WritePanel({ texts, setTexts, active, setActive }: {
  texts: TextItem[]; setTexts: (f: (all: TextItem[]) => TextItem[]) => void; active: string | null; setActive: (id: string | null) => void;
}) {
  const { c, ty } = useTheme();
  const s = useStyles();
  const cur = texts.find((t) => t.id === active);
  const patch = (p: Partial<TextItem>) => cur && setTexts((all) => all.map((t) => (t.id === cur.id ? { ...t, ...p } : t)));
  const add = () => {
    const id = Math.random().toString(36).slice(2, 8);
    setTexts((all) => [...all, { id, t: '', x: 0.5, y: 0.3 + (all.length % 4) * 0.12, color: 'cherry', size: 'm' }]);
    setActive(id);
  };
  if (!cur)
    return (
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Button label="Add text" icon={Plus} tone="ink" onPress={add} />
        <Text style={ty.meta}>{texts.length ? 'Tap a word on the sticker to edit it. Drag to move.' : 'Write anything, then drag it anywhere.'}</Text>
      </View>
    );
  return (
    <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <TextInput
          value={cur.t}
          onChangeText={(t) => patch({ t })}
          placeholder="Type something"
          placeholderTextColor={c.inkSoft}
          maxLength={24}
          autoFocus
          style={[s.input, { flex: 1 }]}
          accessibilityLabel="Sticker text"
        />
        <Button round icon={Trash} a11y="Delete text" onPress={() => (setTexts((all) => all.filter((t) => t.id !== cur.id)), setActive(null))} />
        <Button round icon={Check} tone="ink" a11y="Done" onPress={() => setActive(null)} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {SIZES.map((z) => (
          <Chip key={z} selected={cur.size === z} onPress={() => patch({ size: z })} label={z.toUpperCase()} a11y={`Text size ${z}`} />
        ))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, alignItems: 'center', paddingHorizontal: space.xs }}>
          {(Object.keys(EDGES) as Edge[]).map((e) => (
            <Pressable key={e} onPress={() => patch({ color: e })} accessibilityRole="button" accessibilityLabel={`${e} text`} accessibilityState={{ selected: cur.color === e }}
              hitSlop={6} style={[s.swatch, { backgroundColor: EDGES[e] }, cur.color === e && s.swatchOn]} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** Invisible hit box over a text item drawn by Skia: tap to select, drag to move. */
function TextHandle({ t, size, typeface, selected, onSelect, onMove }: {
  t: TextItem; size: number; typeface: SkTypeface; selected: boolean; onSelect: () => void; onMove: (x: number, y: number) => void;
}) {
  const s = useStyles();
  const m = textMetrics({ ...t, t: t.t || 'Aa' }, typeface);
  const k = size / S;
  const w = Math.max(m.width * k + 16, 44), h = Math.max(m.height * k + 8, 36);
  const start = useSharedValue({ x: 0, y: 0 });
  const clamp = (v: number) => Math.min(Math.max(v, 0.06), 0.94);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      start.set({ x: t.x, y: t.y });
      onSelect();
    })
    .onUpdate((e) => onMove(clamp(start.get().x + e.translationX / size), clamp(start.get().y + e.translationY / size)));
  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="button"
        accessibilityLabel={`Text: ${t.t || 'empty'}. Drag to move.`}
        style={[{ position: 'absolute', left: t.x * size - w / 2, top: t.y * size - h / 2, width: w, height: h, borderRadius: 10 }, selected && s.handleOn]}
      />
    </GestureDetector>
  );
}
