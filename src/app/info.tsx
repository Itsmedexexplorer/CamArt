import Constants from 'expo-constants';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { color, font, glass, radius, space, themed, useTheme } from '@/theme';
import { Ambient } from '@/ui/ambient';
import { Doc, Info as InfoI, Shield, type IconType } from '@/ui/icons';

type Page = { title: string; kicker: string; tint: string; I: IconType; lead: string; points: [string, string][] };

const PAGES: Record<string, Page> = {
  privacy: {
    title: 'Privacy', kicker: 'Plain and short', tint: color.lime, I: Shield,
    lead: 'Your photos stay on this device unless you choose to export or share them.',
    points: [
      ['No account', 'No sign-up, no analytics, no ads, no cloud sync. CamArt never collects your location.'],
      ['Camera only when open', 'The camera runs only while the Camera tab is on screen.'],
      ['Private storage', 'Photos, stickers and notes live in the app’s own storage on your phone.'],
      ['You choose what leaves', 'Backups are files you save where you like. Sharing sends only that sticker, to the app you pick.'],
      ['Delete means gone', 'Deleting a memory removes its sticker and original photo. Deleting the app removes everything.'],
    ],
  },
  terms: {
    title: 'Terms', kicker: 'The short version', tint: color.sun, I: Doc,
    lead: 'CamArt is yours to use for making and keeping little moments.',
    points: [
      ['You own it', 'Every photo, sticker and note you make belongs to you.'],
      ['Keep your own copies', 'Nothing leaves your phone, so we can’t recover lost memories. Back up now and then.'],
      ['Be kind', 'Only photograph people and places you have permission to.'],
      ['As is', 'CamArt is provided as is, without warranties. We’ll keep improving it.'],
    ],
  },
  about: {
    title: 'About', kicker: `Version ${Constants.expoConfig?.version ?? ''}`, tint: color.lilac, I: InfoI,
    lead: 'A tiny daily sticker camera. One small moment, kept as a little printed thing.',
    points: [
      ['Made for every day', 'Open, frame, stamp. Your calendar fills up with tiny collectibles.'],
      ['Offline first', 'Everything works without an internet connection.'],
    ],
  },
};

export default function InfoScreen() {
  const { c, ty } = useTheme();
  const s = useStyles();
  const { page } = useLocalSearchParams<{ page: string }>();
  const p = PAGES[page] ?? PAGES.about;
  return (
    <View style={{ flex: 1 }}>
    <Ambient />
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={[s.hero, { backgroundColor: p.tint }]}>
        <p.I size={34} weight="fill" color={c.onAccent} />
        <Text style={[ty.label, { color: c.onAccent, opacity: 0.7 }]}>{p.kicker}</Text>
        <Text style={[ty.hero, { color: c.onAccent }]}>{p.title}</Text>
        <Text style={[ty.body, { fontFamily: font.uiMedium, color: c.onAccent }]}>{p.lead}</Text>
      </View>
      {p.points.map(([h, b], i) => (
        <View key={h} style={s.point}>
          <Text style={s.num}>{String(i + 1).padStart(2, '0')}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ty.strong}>{h}</Text>
            <Text style={[ty.body, { color: c.inkSoft }]}>{b}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
    </View>
  );
}

const useStyles = themed((c, ty) => StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space.xl, gap: space.sm },
  point: { flexDirection: 'row', gap: space.lg, padding: space.lg, borderRadius: radius.md, ...glass(c) },
  num: { fontFamily: font.display, fontSize: 22, color: c.inkSoft, fontVariant: ['tabular-nums'] },
}));
