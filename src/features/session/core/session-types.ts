// Session Domain Types
// 会话领域类型定义

export interface ResearchSession {
    id: string;

    // Basic information
    title: string;
    description?: string;

    // Research direction
    initialQuestion: string;
    finalDirection?: string;
    researchScope?: string;

    // Associated resources
    researchTreeId?: string;  // 关联的研究树ID
    literatureCollectionId?: string;  // 关联的文献集合ID

    // Session status and workflow
    status: 'direction_finding' | 'tree_building' | 'synthesizing' | 'completed' | 'paused';
    currentPhase: ResearchPhase;

    // Dialogue history with AI
    dialogueHistory: DialogueMessage[];

    // Session configuration
    preferences: SessionPreferences;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    lastAccessedAt: Date;

    // Statistics
    totalTimeSpent: number; // in minutes
    iterationsCompleted: number;
    literatureReviewed: number;
}

export interface DialogueMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;

    // Message metadata
    messageType?: 'question' | 'direction' | 'clarification' | 'summary';
    relatedLiteratureIds?: string[];
    relatedNodeIds?: string[];
}

export interface ResearchPhase {
    name: 'direction_finding' | 'tree_building' | 'synthesizing' | 'completed';
    startedAt: Date;
    completedAt?: Date;
    progress: number; // 0-100

    // Phase-specific data
    phaseData?: {
        // Direction finding phase
        directionFinding?: {
            questionsAsked: number;
            clarificationsMade: number;
            finalDirectionConfirmed: boolean;
        };

        // Tree building phase
        treeBuilding?: {
            mctsIterations: number;
            nodesExpanded: number;
            averageNodeScore: number;
            targetIterations: number;
        };

        // Synthesizing phase
        synthesizing?: {
            reportSections: string[];
            completedSections: string[];
            visualizationsGenerated: number;
        };
    };
}

export interface SessionPreferences {
    // MCTS Configuration
    mctsConfig: {
        explorationWeight: number;
        maxIterations: number;
        maxDepth: number;
        maxNodes: number;
    };

    // Literature preferences
    literatureConfig: {
        maxPapersPerNode: number;
        preferredJournals: string[];
        excludedAuthors: string[];
        minCitationCount?: number;
    };

    // AI preferences
    aiConfig: {
        model: string;
        temperature: number;
        maxTokens: number;
        language: 'en' | 'zh' | 'auto';
    };

    // UI preferences
    uiConfig: {
        defaultTreeView: 'tree' | 'graph' | 'list';
        autoSave: boolean;
        showStatistics: boolean;
    };
}

export interface SessionSummary {
    id: string;
    title: string;
    status: ResearchSession['status'];
    currentPhase: string;
    progress: number;
    lastAccessed: Date;

    // Quick stats
    totalNodes: number;
    totalLiterature: number;
    timeSpent: number;

    // Preview content
    previewText: string;
    thumbnailPath?: string;
}

// Session operations and events
export interface SessionEvent {
    id: string;
    sessionId: string;
    type: 'created' | 'phase_changed' | 'node_added' | 'literature_added' | 'message_sent' | 'paused' | 'resumed' | 'completed';

    data: Record<string, unknown>;
    timestamp: Date;
}

export interface SessionBackup {
    id: string;
    sessionId: string;

    // Snapshot data
    sessionData: ResearchSession;
    treeData?: Record<string, unknown>;  // Tree export data
    literatureData?: Record<string, unknown>;  // Literature export data

    // Backup metadata
    backupType: 'manual' | 'auto' | 'milestone';
    description?: string;
    createdAt: Date;
    size: number; // in bytes
}
