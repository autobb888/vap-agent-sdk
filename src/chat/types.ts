/**
 * Chat types for the VAP Agent SDK.
 */

export interface ChatMessage {
  id: string;
  jobId: string;
  senderVerusId: string;
  content: string;
  type: 'text' | 'file' | 'system';
  createdAt: string;
}

export interface ChatFile {
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}
