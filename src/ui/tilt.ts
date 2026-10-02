import { SensorType, useAnimatedReaction, useAnimatedSensor, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

const DEG = 180 / Math.PI;

/**
 * Spatial tilt: the object leans as you move the phone, like a print held in your hand.
 * Relative to how you hold the phone (the baseline drifts slowly toward it), low-passed so it
 * glides, capped at `max` degrees so it stays a thin card, never a thick 3D block. UI thread only.
 */
export function useTilt(max = 9) {
  const reduce = useReducedMotion();
  const rot = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });
  const base = useSharedValue({ p: 0, r: 0, ready: false });
  const tilt = useSharedValue({ x: 0, y: 0 });

  useAnimatedReaction(
    () => rot.sensor.value,
    (v) => {
      const b = base.value;
      const nb = b.ready ? { p: b.p + (v.pitch - b.p) * 0.015, r: b.r + (v.roll - b.r) * 0.015, ready: true } : { p: v.pitch, r: v.roll, ready: true };
      base.set(nb);
      const clamp = (n: number) => Math.min(Math.max(n, -max), max);
      const tx = clamp((v.pitch - nb.p) * DEG * 0.9);
      const ty = clamp((v.roll - nb.r) * DEG * 0.9);
      const t = tilt.value;
      tilt.set({ x: t.x + (tx - t.x) * 0.18, y: t.y + (ty - t.y) * 0.18 });
    },
  );

  return useAnimatedStyle(() =>
    reduce
      ? {}
      : {
          transform: [
            { perspective: 900 },
            { rotateX: `${-tilt.value.x}deg` },
            { rotateY: `${tilt.value.y}deg` },
            // a hair of parallax drift so it feels like it floats above the page
            { translateX: tilt.value.y * 0.7 },
            { translateY: tilt.value.x * 0.7 },
          ],
        },
  );
}
