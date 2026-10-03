import { Tabs } from 'expo-router/tabs';
import { Animated, Easing, View } from 'react-native';

import { useTheme } from '@/theme';
import { TabBar } from '@/ui/tab-bar';

// Switching tabs: a quick cross-fade with a hint of depth (the incoming page settles from 98% scale).
const fadeLift = ({ current }: { current: { progress: Animated.AnimatedInterpolation<number> } }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.98, 1, 0.98] }) }],
  },
});

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.milk }}>
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'fade', transitionSpec: { animation: 'timing', config: { duration: 220, easing: Easing.out(Easing.cubic) } }, sceneStyleInterpolator: fadeLift }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="memories" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <TabBar />
    </View>
  );
}
