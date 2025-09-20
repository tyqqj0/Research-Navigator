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
    linkedCollectionId?: string; // 绑定的工作集合（Literature 域）
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
export interface Artifact<T = unknown> { id: ArtifactId; kind: string; version: number; data: T; meta?: Record<string, unknown>; createdAt: number }

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
    // Deep Research mode
    | CommandEnvelope<'ToggleDeepResearch', { sessionId: SessionId; enabled: boolean }>
    // Direction phase
    | CommandEnvelope<'ProposeDirection', { sessionId: SessionId; userQuery: string }>
    | CommandEnvelope<'DecideDirection', { sessionId: SessionId; action: 'confirm' | 'refine' | 'cancel'; feedback?: string }>
    // Collection phase
    | CommandEnvelope<'InitCollection', { sessionId: SessionId }>
    | CommandEnvelope<'ExecuteSearch', { sessionId: SessionId; strategy?: string }>
    | CommandEnvelope<'MergeCollection', { sessionId: SessionId; batchId: ArtifactId }>
    | CommandEnvelope<'EvaluateCollection', { sessionId: SessionId }>
    | CommandEnvelope<'StartExpansion', { sessionId: SessionId }>
    | CommandEnvelope<'StopExpansion', { sessionId: SessionId; reason?: string }>
    | CommandEnvelope<'SelectCandidates', { sessionId: SessionId; topK?: number; sinceYear?: number }>
    | CommandEnvelope<'PruneCollection', { sessionId: SessionId; targetMax: number; criterion?: 'citation_low_first' | 'random' }>
    | CommandEnvelope<'BuildGraph', { sessionId: SessionId; window?: number; strategy?: 'nl+struct' }>
    // Session-Collection binding
    | CommandEnvelope<'BindSessionCollection', { sessionId: SessionId; collectionId: string }>;

export type SessionEvent =
    | EventEnvelope<'SessionCreated', { title?: string }>
    | EventEnvelope<'SessionRenamed', { title: string }>
    | EventEnvelope<'UserMessageAdded', { messageId: MessageId; text: string }>
    | EventEnvelope<'AssistantMessageStarted', { messageId: MessageId }>
    | EventEnvelope<'AssistantMessageDelta', { messageId: MessageId; delta: string }>
    | EventEnvelope<'AssistantMessageCompleted', { messageId: MessageId }>
    | EventEnvelope<'AssistantMessageAborted', { messageId: MessageId; reason?: string }>
    | EventEnvelope<'AssistantMessageFailed', { messageId: MessageId; error: string }>
    // Deep Research mode events
    | EventEnvelope<'DeepResearchModeChanged', { enabled: boolean }>
    // Direction phase events
    | EventEnvelope<'DirectionProposed', { proposalText: string; version: number }>
    | EventEnvelope<'DecisionRequested', { kind: 'direction'; version: number }>
    | EventEnvelope<'DirectionDecisionRecorded', { action: 'confirm' | 'refine' | 'cancel'; feedback?: string; version: number }>
    | EventEnvelope<'DirectionConfirmed', { directionSpec: string; version: number }>
    // Collection phase events
    | EventEnvelope<'SearchRoundPlanned', { round: number; reasoning: string; query: string }>
    | EventEnvelope<'SearchExecuted', { batchId: ArtifactId; count: number }>
    | EventEnvelope<'PapersIngested', { batchId: ArtifactId; added: number; total: number }>
    | EventEnvelope<'CollectionUpdated', { collectionId: ArtifactId; version: number; total: number }>
    | EventEnvelope<'ExpansionStarted', {}>
    | EventEnvelope<'SearchRoundStarted', { round: number; query: string }>
    | EventEnvelope<'SearchRoundCompleted', { round: number; added: number; total: number }>
    | EventEnvelope<'NoNewResults', { round: number }>
    | EventEnvelope<'SearchRoundFailed', { round: number; stage: 'thinking' | 'candidates' | 'execute'; error: string }>
    | EventEnvelope<'ExpansionSaturated', { round: number; reason: 'no_new' | 'max_rounds' }>
    | EventEnvelope<'ExpansionEvaluated', { lastAdded: number; recentGrowth: number; coverageScore?: number }>
    | EventEnvelope<'ExpansionStopped', { by: 'user' | 'ai' | 'rule'; reason?: string }>
    | EventEnvelope<'SearchCandidatesReady', { round: number; artifactId: ArtifactId }>
    | EventEnvelope<'CollectionPruned', { removed: number; from: number; to: number; rule: string }>
    | EventEnvelope<'CandidatesSelected', { candidateId: ArtifactId; size: number; ruleSet: string }>
    // Graph construction
    | EventEnvelope<'GraphConstructionStarted', { size: number }>
    | EventEnvelope<'GraphRelationsProposed', { textArtifactId: ArtifactId }>
    | EventEnvelope<'GraphEdgesStructured', { edgeArtifactId: ArtifactId; size: number }>
    | EventEnvelope<'GraphConstructionCompleted', { nodes: number; edges: number }>
    | EventEnvelope<'GraphReady', { graphId: string }>
    // Session-Collection binding
    | EventEnvelope<'SessionCollectionBound', { collectionId: string; created?: boolean }>;



