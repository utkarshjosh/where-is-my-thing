// API Response Types

export interface Item {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  location: string | null;
  location_path: string | null;
  category: string;
}

export interface ItemsResponse {
  items: Item[];
  count: number;
}

export interface DeleteItemResponse {
  status: string;
  message: string;
  thing_name?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'thing' | 'place' | 'intent';
  category: string | null;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

// Voice Agent Types
export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface Transcript {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
}

// WebSocket Message Types
// Note: Audio is now sent as binary frames, not JSON with base64
export type WebSocketMessage =
  | { type: 'audio'; data: string }  // Legacy fallback (base64)
  | { type: 'text'; data: string }
  | { type: 'end_turn' }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'turn_complete' }
  | { type: 'interrupt' }
  | { type: 'audio_start' }  // Signals start of streamed audio
  | { type: 'audio_end' }    // Signals end of streamed audio
  | { type: 'error'; message: string };

// Category definitions
export const categories = {
  keys: { icon: 'IconKey', label: 'Keys', color: '#f59e0b' },
  electronics: { icon: 'IconDeviceMobile', label: 'Electronics', color: '#3b82f6' },
  documents: { icon: 'IconFileText', label: 'Documents', color: '#8b5cf6' },
  books: { icon: 'IconBook', label: 'Books', color: '#ef4444' },
  personal: { icon: 'IconUser', label: 'Personal', color: '#ec4899' },
  home: { icon: 'IconHome', label: 'Home', color: '#10b981' },
  other: { icon: 'IconBox', label: 'Other', color: '#6b7280' },
} as const;

export type CategoryKey = keyof typeof categories;
