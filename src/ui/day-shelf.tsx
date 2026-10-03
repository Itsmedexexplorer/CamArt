import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { Memory } from '@/lib/memories';
import { font, radius, space, themed, useTheme } from '@/theme';
import { Sticker, tilt } from '@/ui/puffy';

/** One day as a sticker board: stickers alternate sides, overlap a little, each at its own angle. */
export function DayShelf({ date, items }: { date: Date; items: Memory[] }) {
  const { ty } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const W = width - space.lg * 2;
  const placed = items.map((m, i) => {
    const t = tilt(m.id);
    const size = W * (items.length === 1 ? 0.7 : 0.5 + (Math.abs(t) % 3) * 0.05);
    const x = items.length === 1 ? (W - size) / 2 : i % 2 ? W - size - Math.abs(t) : Math.abs(t) * 1.5;
    return { m, size, x, y: i * W * 0.36, angle: t };
  });
  const height = Math.max(...placed.map((p) => p.y + p.size));

  return (
    <View style={s.day}>
      <View style={s.head}>
        <Text style={s.num}>{String(date.getDate()).padStart(2, '0')}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ty.strong}>{date.toLocaleDateString(undefined, { month: 'long' })}</Text>
          <Text style={ty.meta}>{date.toLocaleDateString(undefined, { weekday: 'long' })}</Text>
        </View>
        <View style={s.count}>
          <Text style={s.countText}>{items.length}</Text>
        </View>
      </View>
      <View style={{ height }}>
        {placed.map(({ m, size, x, y, angle }) => (
          <Pressable
            key={m.id}
            onPress={() => router.push(`/memory/${m.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open memory${m.caption ? `: ${m.caption}` : ''}, ${new Date(m.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
            style={{ position: 'absolute', left: x, top: y }}>
            <Sticker m={m} size={size} angle={angle} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  day: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  num: { fontFamily: font.display, fontSize: 52, lineHeight: 56, letterSpacing: -2, color: c.ink, fontVariant: ['tabular-nums'] },
  count: { minWidth: 32, height: 32, borderRadius: radius.pill, backgroundColor: c.wash, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  countText: { fontFamily: font.uiBold, color: c.ink },
}));
