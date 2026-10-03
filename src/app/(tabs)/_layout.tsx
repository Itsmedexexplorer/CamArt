import { BlurTargetView } from 'expo-blur';
import { Tabs } from 'expo-router/tabs';
import { useRef } from 'react';
import { View } from 'react-native';

import { Ambient } from '@/ui/ambient';
import { TabBar } from '@/ui/tab-bar';

export default function TabsLayout() {
  const target = useRef<View>(null);
  return (
    <View style={{ flex: 1 }}>
      {/* Screens live inside the blur target; the bar sits outside it so it can blur them. */}
      <BlurTargetView ref={target} style={{ flex: 1 }}>
        <Ambient />
        <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: 'transparent' } }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="memories" />
          <Tabs.Screen name="calendar" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </BlurTargetView>
      <TabBar target={target} />
    </View>
  );
}
