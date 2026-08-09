export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BuildPromptInput {
  systemPrompt: string;
  retrievedChunks: Array<{ content: string; documentId: string; score: number }>;
  conversationHistory: ConversationTurn[];
  userQuery: string;
}

export interface BuiltPrompt {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  contextUsedChars: number;
  chunksUsedCount: number;
}