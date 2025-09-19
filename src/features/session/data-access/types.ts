// Session domain - contracts and minimal types

export type SessionId = string;
export type MessageId = string;
export type ArtifactId = string;
export type CommandId = string;
export type EventId = string;

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

// Projection models (UI-facing)
export interface ChatSession {
    id: SessionId;
    title?: string;
    provider?: string;
    model?: string;
    createdAt: number;
    updatedAt: number;
    meta?: Record<string, unknown>;
}

export type MessageStatus = 'streaming' | 'done' | 'error' | 'aborted';

export interface ChatMessage {
    id: MessageId;
    sessionId: SessionId;
    role: ChatRole;
    content: string;
    status: MessageStatus;
    error?: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    createdAt: number;
}

// Artifacts (immutable large payloads)
export interface ArtifactRef { kind: string; id: ArtifactId; version?: number }

// Events (facts)
export interface EventEnvelope<T extends string = string, P = unknown> {
    id: EventId;
    type: T;
    ts: number;
    sessionId?: SessionId;
    taskId?: string;
    parentTaskId?: string;
    correlationId?: string;
    causationId?: string;
    payload: P;
    artifacts?: ArtifactRef[];
}

// Commands (intent)
export interface CommandEnvelope<T extends string = string, P = unknown> {
    id: CommandId;
    type: T;
    ts: number;
    sessionId?: SessionId;
    targetTaskId?: string;
    params: P;
    inputRefs?: ArtifactRef[];
}

// Specific command/event discriminated unions (minimal set)
export type SessionCommand =
    | CommandEnvelope<'CreateSession', { title?: string }>
    | CommandEnvelope<'SendMessage', { sessionId: SessionId; text: string }>
    | CommandEnvelope<'StopStreaming', { sessionId: SessionId }>
    | CommandEnvelope<'RenameSession', { sessionId: SessionId; title: string }>
    // Direction phase
    | CommandEnvelope<'ProposeDirection', { sessionId: SessionId; userQuery: string }>
    | CommandEnvelope<'DecideDirection', { sessionId: SessionId; action: 'confirm' | 'refine' | 'cancel'; feedback?: string }>;

export type SessionEvent =
    | EventEnvelope<'SessionCreated', { title?: string }>
    | EventEnvelope<'SessionRenamed', { title: string }>
    | EventEnvelope<'UserMessageAdded', { messageId: MessageId; text: string }>
    | EventEnvelope<'AssistantMessageStarted', { messageId: MessageId }>
    | EventEnvelope<'AssistantMessageDelta', { messageId: MessageId; delta: string }>
    | EventEnvelope<'AssistantMessageCompleted', { messageId: MessageId }>
    | EventEnvelope<'AssistantMessageAborted', { messageId: MessageId; reason?: string }>
    | EventEnvelope<'AssistantMessageFailed', { messageId: MessageId; error: string }>
    // Direction phase events
    | EventEnvelope<'DirectionProposed', { proposalText: string; version: number }>
    | EventEnvelope<'DecisionRequested', { kind: 'direction'; version: number }>
    | EventEnvelope<'DirectionDecisionRecorded', { action: 'confirm' | 'refine' | 'cancel'; feedback?: string; version: number }>
    | EventEnvelope<'DirectionConfirmed', { directionSpec: string; version: number }>;


