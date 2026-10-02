import { BlurTargetView } from 'expo-blur';
import { Tabs } from 'expo-router/tabs';
import { useRef } from 'react';
import { View } from 'react-native';

import { color } from '@/theme';
import { TabBar } from '@/ui/tab-bar';

export default function TabsLayout() {
  const target = useRef<View>(null);
  return (
    <View style={{ flex: 1, backgroundColor: color.milk }}>
      {/* Screens live inside the blur target; the bar sits outside it so it can blur them. */}
      <BlurTargetView ref={target} style={{ flex: 1 }}>
        <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'none' }}>
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
