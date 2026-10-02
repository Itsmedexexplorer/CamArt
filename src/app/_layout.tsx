import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useSettings } from '@/lib/settings';
import { font, palettes, SchemeContext, type Scheme } from '@/theme';
import { Intro } from '@/ui/intro';

SplashScreen.preventAutoHideAsync();

const navThemes = {
  light: { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: palettes.light.milk, card: palettes.light.milk, text: palettes.light.ink, primary: palettes.light.cherry, border: palettes.light.line } },
  dark: { ...DarkTheme, colors: { ...DarkTheme.colors, background: palettes.dark.milk, card: palettes.dark.milk, text: palettes.dark.ink, primary: palettes.dark.cherry, border: palettes.dark.line } },
};

export default function Root() {
  const [loaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const system = useColorScheme();
  const { appearance } = useSettings();
  const scheme: Scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  const c = palettes[scheme];
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.milk }}>
      <SchemeContext.Provider value={scheme}>
        <ThemeProvider value={navThemes[scheme]}>
          <StatusBar style={intro || scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontFamily: font.display, fontSize: 20 }, headerTintColor: c.ink, headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="editor" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="memory/[id]" options={{ title: '' }} />
            <Stack.Screen name="info" options={{ presentation: 'modal' }} />
          </Stack>
          <SchemeFade scheme={scheme} />
          {intro && <Intro onDone={() => setIntro(false)} />}
        </ThemeProvider>
      </SchemeContext.Provider>
    </GestureHandlerRootView>
  );
}

/** When the scheme flips, the old background melts away over the new UI instead of snapping. */
function SchemeFade({ scheme }: { scheme: Scheme }) {
  const prev = useRef(scheme);
  const [from, setFrom] = useState<string>(palettes[scheme].milk);
  const o = useSharedValue(0);
  useEffect(() => {
    if (prev.current === scheme) return;
    setFrom(palettes[prev.current].milk);
    prev.current = scheme;
    o.set(withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: 420 })));
  }, [scheme, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: from }, style]} />;
}
