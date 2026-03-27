import { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  Keyboard,
} from "react-native";
import { getCommandSuggestions } from "@/lib/agent/commands";
import type { SlashCommandSuggestion } from "@/lib/agent/types";

interface TerminalInputProps {
  onSubmit: (text: string) => void;
  isThinking: boolean;
}

export function TerminalInput({ onSubmit, isThinking }: TerminalInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<SlashCommandSuggestion[]>([]);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback((text: string) => {
    setInput(text);
    if (text.startsWith("/")) {
      const sug = getCommandSuggestions(text);
      setSuggestions(sug.length > 0 && text.length > 0 ? sug : []);
    } else {
      setSuggestions([]);
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    onSubmit(trimmed);
    setInput("");
    setSuggestions([]);
  }, [input, isThinking, onSubmit]);

  const handleSuggestionSelect = useCallback(
    (cmd: string) => {
      setInput(cmd + " ");
      setSuggestions([]);
      inputRef.current?.focus();
    },
    []
  );

  return (
    <View>
      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <View
          className="mx-4 mb-1 rounded-lg border border-[#30363D] overflow-hidden"
          style={{ backgroundColor: "#161B22" }}
          testID="autocomplete"
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.command}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center gap-3 px-3 py-2"
                onPress={() => handleSuggestionSelect(item.command)}
                activeOpacity={0.7}
                testID={`autocomplete-${item.command.slice(1)}`}
              >
                <Text className="font-mono text-[12px] text-[#58A6FF]">
                  {item.command}
                </Text>
                <Text className="text-[11px] text-[#8B949E]">
                  {item.description}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Input bar */}
      <View
        className="flex-row items-center gap-2 px-4 py-3 border-t border-[#21262D]"
        style={{ backgroundColor: "#0D1117" }}
        testID="input-bar"
      >
        <View
          className="flex-1 flex-row items-center rounded-full px-4"
          style={{
            backgroundColor: "#161B22",
            borderWidth: 1,
            borderColor: "#30363D",
            paddingVertical: 8,
          }}
        >
          <Text className="text-[#484F58] font-mono text-[14px] mr-1">
            {">"}
          </Text>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={handleChangeText}
            onSubmitEditing={handleSend}
            placeholder="Type a command..."
            placeholderTextColor="#484F58"
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 text-[15px] text-white font-mono"
            style={{ paddingVertical: 0 }}
            testID="input-terminal"
          />
        </View>
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || isThinking}
          className="items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor:
              input.trim() && !isThinking ? "#58A6FF" : "#21262D",
          }}
          activeOpacity={0.7}
          testID="button-send"
        >
          <Text
            style={{
              color: input.trim() && !isThinking ? "#0D1117" : "#484F58",
              fontSize: 18,
              fontWeight: "bold",
              marginTop: -1,
            }}
          >
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
