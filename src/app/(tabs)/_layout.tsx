import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { TabBar } from '@/ui/tab-bar';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.milk }}>
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'none' }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="memories" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <TabBar />
    </View>
  );
}
