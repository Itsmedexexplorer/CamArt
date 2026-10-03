import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { byDay, useMemories, type Memory } from '@/lib/memories';
import { FILTER_LABEL, SHAPE_LABEL, type Filter, type Shape } from '@/lib/sticker';
import { font, radius, space, themed, useTheme, bouncy } from '@/theme';
import { DayShelf } from '@/ui/day-shelf';
import { Close, Search } from '@/ui/icons';
import { Button, Empty, Sticker, Surface } from '@/ui/puffy';
import { useTabSpace } from '@/ui/tab-bar';

/** Everything a person might type to find a memory: note, shape, filter, and the day in words. */
function haystack(m: Memory) {
  const d = new Date(m.createdAt);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  return [
    m.caption, SHAPE_LABEL[m.shape as Shape], FILTER_LABEL[m.filter as Filter],
    d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    d.toLocaleDateString(undefined, { month: 'short' }), days === 0 ? 'today' : days === 1 ? 'yesterday' : '',
  ].join(' ').toLowerCase();
}

export default function Memories() {
  const { c, ty, scheme } = useTheme();
  const s = useStyles();
  const memories = useMemories();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabSpace();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  // Ride above the keyboard while typing, so the field and results stay visible.
  const kb = useAnimatedKeyboard();
  const searchLift = useAnimatedStyle(() => ({ bottom: Math.max(tabSpace, kb.height.value + space.md) }));
  const days = useMemo(() => [...byDay(memories)], [memories]);
  const index = useMemo(() => new Map(memories.map((m) => [m.id, haystack(m)])), [memories]);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? memories.filter((m) => terms.every((t) => index.get(m.id)!.includes(t))) : null;
  const cell = (width - space.lg * 2 - space.md * 2) / 3;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: c.milk }}>
        {hits ? (
          <FlatList
            key="hits"
            data={hits}
            numColumns={3}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            columnWrapperStyle={{ gap: space.md }}
            contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: tabSpace + 72, gap: space.md }}
            ListHeaderComponent={<Text style={[ty.title, { marginBottom: space.md }]}>{hits.length ? `${hits.length} found` : 'Nothing matches'}</Text>}
            renderItem={({ item, index: i }) => (
              <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(bouncy.damping).stiffness(bouncy.stiffness).delay(Math.min(i, 12) * 40)}>
                <Pressable onPress={() => router.push(`/memory/${item.id}`)} accessibilityRole="button" accessibilityLabel={item.caption || 'Sticker memory'}>
                  <Sticker m={item} size={cell} />
                </Pressable>
              </Animated.View>
            )}
          />
        ) : (
          <FlatList
            key="board"
            data={days}
            keyExtractor={([k]) => k}
            contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: tabSpace + 72 }}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
                <Text style={ty.label}>Your sticker book</Text>
                <Text style={ty.hero}>Memories</Text>
              </View>
            }
            ListEmptyComponent={
              <Empty
                title="Today's first sticker is waiting"
                body="Find one small thing worth keeping. A cup, a window, a face."
                action={<Button label="Open camera" tone="cherry" onPress={() => router.navigate('/')} />}
              />
            }
            renderItem={({ item: [, items] }) => <DayShelf date={new Date(items[0].createdAt)} items={items} />}
            initialNumToRender={3}
            windowSize={5}
          />
        )}
      </View>

      {memories.length > 0 && (
        <Animated.View style={[s.searchWrap, searchLift]}>
        <Surface style={s.search}>
          <Search size={20} color={c.ink} weight="bold" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search notes, days, shapes"
            placeholderTextColor={c.inkSoft}
            keyboardAppearance={scheme}
            returnKeyType="search"
            style={[s.input, { color: c.ink }]}
            accessibilityLabel="Search memories"
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Close size={18} color={c.ink} weight="bold" />
            </Pressable>
          ) : null}
        </Surface>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  searchWrap: { position: 'absolute', alignSelf: 'center', width: '82%' },
  search: { height: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  input: { flex: 1, fontFamily: font.uiMedium, fontSize: 16, color: c.ink, paddingVertical: 0 },
}));
