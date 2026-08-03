import { RAG_CONFIG } from '@/config/rag.config.js';
import type{ BuildPromptInput, BuiltPrompt } from '@/moduels/prompt/promptbuilder.types.js';

function buildContextBlock(chunks: BuildPromptInput['retrievedChunks']): { text: string; usedCount: number; usedChars: number } {
  const { maxContextChars } = RAG_CONFIG.promptBuilder;

  let usedChars = 0;
  const included: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const entry = `[Source ${i + 1}]\n${chunk.content}`;
    if (usedChars + entry.length > maxContextChars && included.length > 0) {
      break; // budget exhausted — but always include at least one chunk even if it alone exceeds budget, since some context beats none
    }
    included.push(entry);
    usedChars += entry.length;
  }

  return {
    text: included.join('\n\n'),
    usedCount: included.length,
    usedChars,
  };
}

export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const { systemPrompt, retrievedChunks, conversationHistory, userQuery } = input;
  const { maxHistoryMessages } = RAG_CONFIG.promptBuilder;

  const context = buildContextBlock(retrievedChunks);

  const systemMessageParts = [systemPrompt.trim()];

  if (context.text) {
    systemMessageParts.push(
      'Use the following retrieved context to answer the user\'s question. ' +
        'If the context does not contain relevant information, say so explicitly rather than guessing.\n\n' +
        `---\n${context.text}\n---`,
    );
  }

  const messages: BuiltPrompt['messages'] = [
    { role: 'system', content: systemMessageParts.join('\n\n') },
  ];

  // Keep only the most recent N turns — older history is dropped rather
  // than summarized for now (summarization is a Future Feature per your
  // roadmap: "Conversation memory" is explicitly out of scope until RAG
  // itself is done).
  const recentHistory = conversationHistory.slice(-maxHistoryMessages);
  for (const turn of recentHistory) {
    messages.push({ role: turn.role, content: turn.content });
  }

  messages.push({ role: 'user', content: userQuery });

  return {
    messages,
    contextUsedChars: context.usedChars,
    chunksUsedCount: context.usedCount,
  };
}