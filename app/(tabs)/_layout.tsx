import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0D1117",
          borderTopColor: "#21262D",
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: "#58A6FF",
        tabBarInactiveTintColor: "#484F58",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Terminal",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⌨</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🕐</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚙</Text>
          ),
        }}
      />
    </Tabs>
  );
}
