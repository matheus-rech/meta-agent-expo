/**
 * Memory System
 * Manages conversation history and session state with AsyncStorage persistence
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Message, SessionState } from "./types";

const STORAGE_KEYS = {
  MESSAGES: "agent_messages",
  SESSION: "agent_session",
  HISTORY: "command_history",
};

const MAX_MESSAGES = 100;
const MAX_HISTORY = 500;

export class Memory {
  private messages: Message[] = [];
  private commandHistory: string[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async load(): Promise<void> {
    try {
      const [messagesJson, historyJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
      ]);

      if (messagesJson) {
        this.messages = JSON.parse(messagesJson);
      }
      if (historyJson) {
        this.commandHistory = JSON.parse(historyJson);
      }
    } catch (error) {
      console.error("Failed to load memory:", error);
      this.messages = [];
      this.commandHistory = [];
    }
  }

  async save(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(
          STORAGE_KEYS.MESSAGES,
          JSON.stringify(this.messages)
        ),
        AsyncStorage.setItem(
          STORAGE_KEYS.HISTORY,
          JSON.stringify(this.commandHistory)
        ),
      ]);
    } catch (error) {
      console.error("Failed to save memory:", error);
    }
  }

  addMessage(message: Omit<Message, "timestamp">): Message {
    const fullMessage: Message = {
      ...message,
      timestamp: Date.now(),
    };

    this.messages.push(fullMessage);

    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }

    this.save();
    return fullMessage;
  }

  addToHistory(command: string): void {
    if (this.commandHistory[this.commandHistory.length - 1] !== command) {
      this.commandHistory.push(command);
    }

    if (this.commandHistory.length > MAX_HISTORY) {
      this.commandHistory = this.commandHistory.slice(-MAX_HISTORY);
    }

    this.save();
  }

  getMessages(limit?: number): Message[] {
    const n = limit || MAX_MESSAGES;
    return this.messages.slice(-n);
  }

  getFormattedHistory(
    limit: number = 20
  ): { role: "user" | "assistant"; content: string }[] {
    return this.messages
      .filter((m) => m.role !== "system")
      .slice(-limit)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
  }

  getCommandHistory(): string[] {
    return [...this.commandHistory];
  }

  searchHistory(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.commandHistory.filter((cmd) =>
      cmd.toLowerCase().includes(lowerQuery)
    );
  }

  clearMessages(): void {
    this.messages = [];
    this.save();
  }

  clearHistory(): void {
    this.commandHistory = [];
    this.save();
  }

  async clearAll(): Promise<void> {
    this.messages = [];
    this.commandHistory = [];
    this.sessionId = this.generateSessionId();

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES),
      AsyncStorage.removeItem(STORAGE_KEYS.HISTORY),
      AsyncStorage.removeItem(STORAGE_KEYS.SESSION),
    ]);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getState(): SessionState {
    return {
      id: this.sessionId,
      messages: this.messages,
      isThinking: false,
      lastActivity: Date.now(),
    };
  }
}

// Singleton
let memoryInstance: Memory | null = null;

export function getMemory(): Memory {
  if (!memoryInstance) {
    memoryInstance = new Memory();
  }
  return memoryInstance;
}

export async function initializeMemory(): Promise<Memory> {
  const memory = getMemory();
  await memory.load();
  return memory;
}
