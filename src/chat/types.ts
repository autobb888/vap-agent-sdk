/**
 * Chat types for the VAP Agent SDK.
 */

// Re-export the canonical ChatMessage type from client
export type { ChatMessage } from '../client/index.js';

export interface ChatFile {
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}
