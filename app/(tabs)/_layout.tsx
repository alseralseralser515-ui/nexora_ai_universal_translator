import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={() => null}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Translator",
        }}
      />
    </Tabs>
  );
}
