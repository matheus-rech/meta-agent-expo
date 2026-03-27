import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMemory } from "@/lib/agent/memory";

interface HistoryItem {
  command: string;
  index: number;
}

export default function HistoryScreen() {
  const [commands, setCommands] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCommands, setFilteredCommands] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(() => {
    const memory = getMemory();
    const history = memory.getCommandHistory();
    const items = history.map((cmd, i) => ({ command: cmd, index: i }));
    setCommands(items);
    setFilteredCommands(items);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCommands(commands);
    } else {
      const lower = searchQuery.toLowerCase();
      setFilteredCommands(
        commands.filter((item) => item.command.toLowerCase().includes(lower))
      );
    }
  }, [searchQuery, commands]);

  const handleClear = useCallback(() => {
    const memory = getMemory();
    memory.clearHistory();
    setCommands([]);
    setFilteredCommands([]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) => (
      <View
        className="flex-row items-start gap-3 px-4 py-3 border-b border-[#21262D]"
        testID={`history-item-${item.index}`}
      >
        <Text className="text-[12px] font-mono text-[#484F58] w-6 text-right">
          {item.index + 1}
        </Text>
        <Text className="text-[13px] font-mono text-[#C9D1D9] flex-1" selectable>
          {item.command}
        </Text>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0D1117" }}
      edges={["top"]}
    >
      <View style={{ flex: 1, backgroundColor: "#0D1117" }}>
        {/* Header */}
        <View className="px-4 py-4 flex-row items-center justify-between">
          <Text className="text-[20px] font-bold text-[#C9D1D9]">History</Text>
          {commands.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              className="px-3 py-1.5 rounded-lg border border-[#F8514940]"
              style={{ backgroundColor: "rgba(248, 81, 73, 0.06)" }}
              activeOpacity={0.7}
              testID="button-clear-history"
            >
              <Text className="text-[12px] text-[#F85149] font-medium">
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        <View className="px-4 mb-2">
          <View
            className="flex-row items-center rounded-lg px-3"
            style={{
              backgroundColor: "#161B22",
              borderWidth: 1,
              borderColor: "#30363D",
              height: 36,
            }}
          >
            <Text className="text-[#484F58] mr-2">🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search history..."
              placeholderTextColor="#484F58"
              className="flex-1 text-[13px] font-mono text-[#C9D1D9]"
              style={{ paddingVertical: 0 }}
              autoCapitalize="none"
              testID="input-search-history"
            />
          </View>
        </View>

        {/* List */}
        {filteredCommands.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-[15px] text-[#484F58]">
              {commands.length === 0
                ? "No command history yet."
                : "No matching commands."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={[...filteredCommands].reverse()}
            keyExtractor={(item) => `${item.index}`}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            testID="history-list"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
