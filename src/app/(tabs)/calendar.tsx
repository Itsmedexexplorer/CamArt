import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabSpace } from '@/ui/tab-bar';

import { onThisDay, streak } from '@/lib/journal';
import { byDay, dayKey, useMemories, type Memory } from '@/lib/memories';
import { font, glass, motion, radius, space, themed, tintGlass, useTheme } from '@/theme';
import { DayShelf } from '@/ui/day-shelf';
import { Next, Prev } from '@/ui/icons';
import { Button, Sticker } from '@/ui/puffy';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Calendar() {
  const { c, ty, scheme } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabSpace();
  const { width } = useWindowDimensions();
  const memories = useMemories();
  const days = byDay(memories);
  const run = streak(memories);
  const past = onThisDay(memories);
  const today = dayKey(new Date());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);

  const cells = useMemo(() => {
    const lead = month.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const cell = Math.floor((width - space.md * 2) / 7);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const picked = days.get(selected);
  const filled = cells.filter((d) => d && days.has(dayKey(d))).length;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: tabSpace }}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={ty.label}>{month.getFullYear()}</Text>
          <Text style={ty.hero}>{month.toLocaleDateString(undefined, { month: 'long' })}</Text>
        </View>
        <Button round tone="soft" icon={Prev} a11y="Previous month" onPress={() => shift(-1)} />
        <Button round tone="soft" icon={Next} a11y="Next month" onPress={() => shift(1)} />
      </View>

      <View style={s.statRow}>
        <View style={[s.stat, { backgroundColor: tintGlass(c.lime, scheme) }]}>
          <Text style={s.statNum}>{filled}</Text>
          <Text style={s.statLabel}>days stuck</Text>
        </View>
        <View style={[s.stat, { backgroundColor: tintGlass(c.lilac, scheme) }]}>
          <Text style={s.statNum}>{cells.reduce((n, d) => n + (d ? days.get(dayKey(d))?.length ?? 0 : 0), 0)}</Text>
          <Text style={s.statLabel}>stickers</Text>
        </View>
        <View style={[s.stat, { backgroundColor: tintGlass(c.sun, scheme) }]}>
          <Text style={s.statNum}>{run.days}</Text>
          <Text style={s.statLabel}>{run.days && !run.alive ? 'streak · stick one today' : 'day streak'}</Text>
        </View>
      </View>

      {past && (
        <View style={s.past}>
          <Text style={ty.label}>On this day</Text>
          <Text style={ty.title}>{past.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingTop: space.sm }}>
            {past.items.map((m) => (
              <Pressable key={m.id} onPress={() => router.push(`/memory/${m.id}`)} accessibilityRole="button" accessibilityLabel={`Open memory from ${past.label}`}>
                <Sticker m={m} size={96} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={s.grid}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[ty.label, { width: cell, textAlign: 'center', marginBottom: space.sm }]}>{w}</Text>
        ))}
        {cells.map((d, i) =>
          d ? (
            <Day key={i} d={d} size={cell} items={days.get(dayKey(d))} isToday={dayKey(d) === today} selected={dayKey(d) === selected} onPress={() => setSelected(dayKey(d))} />
          ) : (
            <View key={i} style={{ width: cell, height: cell }} />
          ),
        )}
      </View>

      <View style={{ paddingTop: space.xl }}>
        {picked ? (
          <DayShelf date={new Date(picked[0].createdAt)} items={picked} />
        ) : (
          <Text style={[ty.body, { color: c.inkSoft, textAlign: 'center', padding: space.xl }]}>
            {selected === today ? 'Nothing stuck here yet today.' : 'No stickers this day.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function Day({ d, size, items, isToday, selected, onPress }: { d: Date; size: number; items?: Memory[]; isToday: boolean; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const reduce = useReducedMotion();
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(selected && !reduce ? 1.08 : 1, { duration: motion.select }) }] }));
  const label = `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ', today' : ''}, ${items?.length ?? 0} stickers`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} style={{ width: size, height: size, padding: 3 }}>
      <Animated.View style={[s.day, items && s.dayFull, selected && s.selected, pop]}>
        {items ? (
          <>
            <View style={[StyleSheet.absoluteFill, s.center]}>
              <Sticker m={items[0]} size={size * 0.92} />
            </View>
            {items.length > 1 && (
              <View style={s.count}>
                <Text style={s.countText}>{items.length}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[s.num, selected && { color: c.milk }]}>{d.getDate()}</Text>
        )}
        {isToday && <View style={[s.todayDot, selected && !items && { backgroundColor: c.milk }]} />}
      </Animated.View>
    </Pressable>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  statRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl },
  past: { marginHorizontal: space.lg, marginBottom: space.xl, padding: space.lg, borderRadius: radius.lg, ...glass(c), gap: 2 },
  stat: { flex: 1, borderRadius: radius.lg, padding: space.lg, gap: 2 , borderWidth: 1, borderColor: c.glassEdge },
  statNum: { fontFamily: font.display, fontSize: 34, lineHeight: 38, color: c.onAccent, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: font.uiBold, fontSize: 13, color: c.onAccent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md },
  day: { flex: 1, borderRadius: radius.sm + 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glassSoft, borderWidth: 1, borderColor: c.glassEdge },
  dayFull: { backgroundColor: 'transparent' },
  selected: { backgroundColor: c.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: font.displaySemi, fontSize: 17, color: c.ink, fontVariant: ['tabular-nums'] },
  todayDot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: c.cherry },
  count: { position: 'absolute', right: -3, top: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFFFFF', fontSize: 11, fontFamily: font.uiBold },
}));
