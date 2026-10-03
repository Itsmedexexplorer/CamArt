import { Canvas, Group, LinearGradient, Path, PathOp, Shader, Shadow, Skia, vec } from '@shopify/react-native-skia';
import { CameraView, useCameraPermissions, type FlashMode } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { dayKey, keepOriginal, useMemories } from '@/lib/memories';
import { EDGES, grainEffect, SHAPE_EDGE, SHAPE_LABEL, shapePath, windowPath, type Shape } from '@/lib/sticker';
import { settle, color, font, motion, space, useTheme } from '@/theme';
import { Flash, FlashAuto, FlashOff, Flip } from '@/ui/icons';
import { Button, Empty, Glass } from '@/ui/puffy';
import { ShapeDial } from '@/ui/shape-dial';
import { useTabSpace } from '@/ui/tab-bar';

const FLASH_NEXT: Record<FlashMode, FlashMode> = { off: 'auto', auto: 'on', on: 'off', screen: 'off' };
const FLASH_ICON = { off: FlashOff, auto: FlashAuto, on: Flash, screen: Flash };
const WHITE = color.paper;
const WHITE_SOFT = 'rgba(255,255,255,0.72)';
// ponytail: CameraView zoom is 0..1 across the device's range; these assume ~8x max. Calibrate per device if labels drift.
const ZOOMS = [{ label: '1×', z: 0 }, { label: '2×', z: 0.14 }, { label: '3×', z: 0.29 }];
const NAME_H = 40, DIAL_H = 76, ROW_H = 84;

export default function CameraScreen() {
  const [perm, requestPerm] = useCameraPermissions();
  const { c } = useTheme();
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => (setFocused(true), () => setFocused(false)), []));

  if (!perm) return <View style={s.fill} />;
  if (!perm.granted)
    return (
      <View style={[s.fill, { backgroundColor: c.milk, justifyContent: 'center' }]}>
        <Empty
          title="Point it at today"
          body="CamArt needs the camera to turn moments into stickers. Your photos stay on this device."
          action={
            perm.canAskAgain ? (
              <Button label="Allow camera" tone="cherry" onPress={requestPerm} />
            ) : (
              <Button label="Open Settings" tone="cherry" onPress={() => Linking.openSettings()} />
            )
          }
        />
      </View>
    );
  return focused ? <Camera /> : <View style={s.fill} />;
}

function Camera() {
  const cam = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const tabSpace = useTabSpace();
  const reduce = useReducedMotion();
  const memories = useMemories();
  const today = memories.filter((m) => dayKey(new Date(m.createdAt)) === dayKey(new Date())).length;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [torch, setTorch] = useState(false);
  const [shape, setShape] = useState<Shape>('stamp');
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const pinchStart = useSharedValue(0);
  const busy = useRef(false);
  const zoomAnim = useRef(0);

  // Frame geometry, in screen points. Shrinks on short screens so it never meets the dial.
  // Vertical rhythm: top bar | frame | name | dial | shutter row | tab bar. Leftover space is split
  // evenly above and below the frame so nothing crowds.
  const top = insets.top + 72;
  const below = NAME_H + DIAL_H + ROW_H + space.lg * 3;
  const side = Math.max(Math.min(box.w * 0.84, box.h - top - below - tabSpace - space.lg), 150);
  const free = Math.max(box.h - top - side - below - tabSpace, 0);
  const cx = box.w / 2;
  const cy = top + free / 2 + side / 2;
  const paperObject = shape === 'stamp' || shape === 'polaroid';
  const frame = useMemo(() => {
    if (!box.w) return null;
    const x = cx - side / 2, y = cy - side / 2;
    const outline = shapePath(shape, x, y, side);
    const win = windowPath(shape, x, y, side);
    const band = paperObject ? Skia.Path.MakeFromOp(outline, win, PathOp.Difference) : null;
    // Everything outside the frame becomes one sheet of smoked glass, so only the frame is "open".
    const glass = Skia.Path.MakeFromOp(Skia.Path.Rect(Skia.XYWHRect(0, 0, box.w, box.h)), outline, PathOp.Difference);
    return { outline, band, glass };
  }, [shape, box.w, box.h, cx, cy, side, paperObject]);
  const tint = EDGES[SHAPE_EDGE[shape]];

  // Motion: a new shape clicks into place (quick squeeze, lively release); capture "stamps" it down and back.
  const fade = useSharedValue(1);
  const stamp = useSharedValue(1);
  useEffect(() => {
    fade.set(withSequence(withTiming(0.4, { duration: 0 }), withTiming(1, { duration: motion.select })));
    if (!reduce) stamp.set(withSequence(withTiming(0.9, { duration: 70 }), withSpring(1, settle)));
  }, [shape, fade, stamp, reduce]);
  const frameStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: stamp.value }] }));

  const flashO = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashO.value }));
  const press = useSharedValue(0);
  const coreStyle = useAnimatedStyle(() =>
    reduce ? { opacity: 1 - press.value * 0.3 } : { transform: [{ scale: 1 - press.value * 0.1 }] },
  );

  const pickShape = (sh: Shape) => {
    if (sh === shape) return;
    setShape(sh);
    haptic.select();
  };

  async function capture() {
    if (busy.current || !ready || !cam.current) return;
    busy.current = true;
    haptic.capture();
    if (!reduce) stamp.set(withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, settle)));
    // Front camera has no LED: light the face with a full white screen instead.
    const screenFlash = facing === 'front' && flash !== 'off';
    if (screenFlash) {
      flashO.set(withTiming(1, { duration: 60 }));
      await new Promise((r) => setTimeout(r, 260));
    } else flashO.set(withSequence(withTiming(0.9, { duration: 0 }), withTiming(0, { duration: motion.flash })));
    // "On" lights the LED as a torch for a beat before the shot: the capture-time flash alone is
    // unreliable on many Android phones, and the beat also lets exposure settle on the lit scene.
    const ledFlash = facing === 'back' && flash === 'on';
    try {
      if (ledFlash) {
        setTorch(true);
        await new Promise((r) => setTimeout(r, 450));
      }
      const pic = await cam.current.takePictureAsync({ quality: 0.92 });
      if (screenFlash) flashO.set(withTiming(0, { duration: 160 }));
      // Map the on-screen frame into photo pixels (preview is aspect-fill).
      const scale = Math.max(box.w / pic.width, box.h / pic.height);
      const oy = (box.h - pic.height * scale) / 2;
      const crop = { cy: (cy - oy) / scale / pic.height, frac: side / scale / pic.height };
      const { id, original } = await keepOriginal(pic.uri);
      router.push({ pathname: '/editor', params: { id, original, shape, cy: String(crop.cy), frac: String(crop.frac) } });
    } catch (e) {
      flashO.set(0);
      haptic.error();
      Alert.alert('Could not take photo', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setTorch(false);
      busy.current = false;
    }
  }

  const FlashI = FLASH_ICON[flash];

  // One button cycles 1× → 2× → 3× (gliding); pinch still sets anything in between.
  const zi = ZOOMS.findIndex((o) => Math.abs(zoom - o.z) < 0.05);
  const zoomLabel = zi >= 0 ? ZOOMS[zi].label : `${(1 + zoom * 7).toFixed(1)}×`;
  const cycleZoom = () => {
    zoomTo(ZOOMS[(zi + 1) % ZOOMS.length].z);
    haptic.select();
  };

  // Smooth zoom: glide to a preset over ~240ms instead of jumping.
  function zoomTo(to: number) {
    cancelAnimationFrame(zoomAnim.current);
    const from = zoom, t0 = Date.now();
    const step = () => {
      const k = Math.min((Date.now() - t0) / 240, 1);
      setZoom(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) zoomAnim.current = requestAnimationFrame(step);
    };
    step();
  }
  // Pinch anywhere on the preview to zoom.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => pinchStart.set(zoom))
    .onUpdate((e) => setZoom(Math.min(Math.max(pinchStart.get() + (e.scale - 1) * 0.35, 0), 1)));

  return (
    <View style={s.fill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <StatusBar style="light" />
      <CameraView
        ref={cam}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={facing === 'back' && flash === 'auto' ? 'auto' : 'off'}
        enableTorch={torch}
        mirror={facing === 'front'}
        zoom={zoom}
        onCameraReady={() => setReady(true)}
      />

      {frame && (
        <>
          {/* Smoked glass outside the frame: translucent tint, a breath of frost grain, a top sheen. */}
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {frame.glass && (
              <>
                <Path path={frame.glass} color="rgba(10,12,18,0.58)" />
                <Group opacity={0.05} blendMode="overlay">
                  <Path path={frame.glass}>
                    <Shader source={grainEffect} uniforms={{ seed: 3.1 }} />
                  </Path>
                </Group>
                <Path path={frame.glass}>
                  <LinearGradient start={vec(0, 0)} end={vec(box.w * 0.4, box.h * 0.5)} colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']} />
                </Path>
              </>
            )}
          </Canvas>
          {/* The frame itself: lifted off the scene with a soft drop shadow. */}
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [cx, cy, 0] }, frameStyle]} pointerEvents="none">
            <Canvas style={StyleSheet.absoluteFill}>
              {frame.band ? (
                <Path path={frame.band} color={tint}>
                  <Shadow dx={0} dy={8} blur={14} color="rgba(0,0,0,0.45)" />
                </Path>
              ) : (
                <Path path={frame.outline} color={tint} style="stroke" strokeWidth={12} strokeJoin="round">
                  <Shadow dx={0} dy={8} blur={14} color="rgba(0,0,0,0.45)" />
                </Path>
              )}
            </Canvas>
          </Animated.View>
        </>
      )}

      <GestureDetector gesture={pinch}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      <View style={[s.top, { paddingTop: insets.top + space.sm }]}>
        <Button round tone="glass" camera icon={FlashI} a11y={`Flash ${flash}`} onPress={() => setFlash(FLASH_NEXT[flash])} />
        <Glass camera style={s.dateChip}>
          <Text style={s.date}>{new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
          <View style={s.countDot}>
            <Text style={s.countNum}>{today}</Text>
          </View>
        </Glass>
        <Button round tone="glass" camera icon={Flip} a11y="Flip camera" onPress={() => (setFacing(facing === 'back' ? 'front' : 'back'), zoomTo(0))} />
      </View>
      {flash !== 'off' && (
        <Text style={[s.kicker, { position: 'absolute', alignSelf: 'center', top: insets.top + 60 }]}>{facing === 'front' ? 'Screen flash' : `Flash ${flash}`}</Text>
      )}

      {frame && (
        <Text style={[s.name, { top: cy + side / 2 + space.lg }]} pointerEvents="none">{SHAPE_LABEL[shape]}</Text>
      )}

      <View style={[s.bottom, { bottom: tabSpace + space.lg }]}>
        {box.w > 0 && <ShapeDial width={box.w} value={shape} onChange={pickShape} />}
        <View style={s.row}>
          <Pressable onPress={cycleZoom} accessibilityRole="button" accessibilityLabel={`Zoom ${zoomLabel}, tap to change`} hitSlop={6}>
            <Glass camera style={s.side}>
              <Text style={s.zoomText}>{zoomLabel}</Text>
            </Glass>
          </Pressable>
          <Pressable
            onPressIn={() => press.set(withTiming(1, { duration: motion.press }))}
            onPressOut={() => press.set(withSpring(0, settle))}
            onPress={capture}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={s.shutter}>
            <Animated.View style={[s.shutterDisc, coreStyle]} />
          </Pressable>
          <View style={{ width: 56 }} />
        </View>
      </View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, flashStyle]} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0B0D12' },
  top: { position: 'absolute', left: 0, right: 0, paddingHorizontal: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontFamily: font.uiBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: WHITE_SOFT },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 24, paddingLeft: space.lg, paddingRight: 6 },
  date: { fontFamily: font.display, fontSize: 18, letterSpacing: -0.3, color: WHITE },
  countDot: { minWidth: 36, height: 36, borderRadius: 18, paddingHorizontal: 8, backgroundColor: color.lime, alignItems: 'center', justifyContent: 'center' },
  countNum: { fontFamily: font.display, fontSize: 16, color: color.ink },
  zoomText: { fontFamily: font.display, fontSize: 17, color: WHITE },
  name: { position: 'absolute', alignSelf: 'center', height: NAME_H, fontFamily: font.display, fontSize: 30, letterSpacing: -1, color: WHITE },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: space.lg },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xxl },
  // Pro shutter: thick white ring, a clear gap, solid white disc.
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  shutterDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: WHITE },
  side: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
