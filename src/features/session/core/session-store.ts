// Session Domain - Zustand Store
// 会话领域状态管理

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
    ResearchSession,
    DialogueMessage,
    SessionPreferences,
    SessionSummary,
    SessionEvent
} from './session-types';

interface SessionState {
    // 当前活跃会话
    currentSession: ResearchSession | null;

    // 所有会话列表
    sessions: SessionSummary[];

    // 对话状态
    isTyping: boolean;
    pendingMessage: string;

    // 会话事件历史
    recentEvents: SessionEvent[];

    // UI状态
    sidebarCollapsed: boolean;
    activeTab: 'dialogue' | 'tree' | 'literature' | 'analysis';

    // 加载状态
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // Session management
    setCurrentSession: (session: ResearchSession | null) => void;
    createSession: (initialData: Partial<ResearchSession>) => Promise<ResearchSession>;
    updateSession: (sessionId: string, updates: Partial<ResearchSession>) => void;
    deleteSession: (sessionId: string) => void;

    // Session list management
    setSessions: (sessions: SessionSummary[]) => void;
    refreshSessions: () => Promise<void>;

    // Dialogue operations
    addMessage: (message: DialogueMessage) => void;
    updateMessage: (messageId: string, updates: Partial<DialogueMessage>) => void;
    clearDialogue: () => void;

    // Dialogue UI state
    setIsTyping: (typing: boolean) => void;
    setPendingMessage: (message: string) => void;

    // Phase management
    advancePhase: () => void;
    setPhaseProgress: (progress: number) => void;

    // Preferences
    updatePreferences: (updates: Partial<SessionPreferences>) => void;

    // Events
    addEvent: (event: SessionEvent) => void;

    // UI state
    setSidebarCollapsed: (collapsed: boolean) => void;
    setActiveTab: (tab: 'dialogue' | 'tree' | 'literature' | 'analysis') => void;

    // Loading states
    setLoading: (loading: boolean) => void;
    setSaving: (saving: boolean) => void;
    setError: (error: string | null) => void;

    // Computed getters
    getCurrentPhase: () => string;
    getSessionProgress: () => number;
    getRecentMessages: (limit?: number) => DialogueMessage[];
    canAdvancePhase: () => boolean;
}

const defaultPreferences: SessionPreferences = {
    mctsConfig: {
        explorationWeight: 1.414,
        maxIterations: 100,
        maxDepth: 8,
        maxNodes: 500
    },
    literatureConfig: {
        maxPapersPerNode: 5,
        preferredJournals: [],
        excludedAuthors: [],
        minCitationCount: 1
    },
    aiConfig: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        language: 'auto'
    },
    uiConfig: {
        defaultTreeView: 'tree',
        autoSave: true,
        showStatistics: true
    }
};

export const useSessionStore = create<SessionState>()(
    devtools(
        persist(
            (set, get) => ({
                // 初始状态
                currentSession: null,
                sessions: [],
                isTyping: false,
                pendingMessage: '',
                recentEvents: [],
                sidebarCollapsed: false,
                activeTab: 'dialogue',
                isLoading: false,
                isSaving: false,
                error: null,

                // Session management
                setCurrentSession: (session) => {
                    set({ currentSession: session, error: null });

                    if (session) {
                        // Update last accessed time
                        // Update last accessed time in store
                        // const updatedSession = {
                        //     ...session,
                        //     lastAccessedAt: new Date()
                        // };
                        get().updateSession(session.id, { lastAccessedAt: new Date() });
                    }
                },

                createSession: async (initialData) => {
                    const newSession: ResearchSession = {
                        id: crypto.randomUUID(),
                        title: initialData.title || '新研究会话',
                        description: initialData.description,
                        initialQuestion: initialData.initialQuestion || '',
                        status: 'direction_finding',
                        currentPhase: {
                            name: 'direction_finding',
                            startedAt: new Date(),
                            progress: 0
                        },
                        dialogueHistory: [],
                        preferences: { ...defaultPreferences, ...initialData.preferences },
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lastAccessedAt: new Date(),
                        totalTimeSpent: 0,
                        iterationsCompleted: 0,
                        literatureReviewed: 0,
                        ...initialData
                    };

                    // Add to sessions list
                    const sessionSummary: SessionSummary = {
                        id: newSession.id,
                        title: newSession.title,
                        status: newSession.status,
                        currentPhase: newSession.currentPhase.name,
                        progress: newSession.currentPhase.progress,
                        lastAccessed: newSession.lastAccessedAt,
                        totalNodes: 0,
                        totalLiterature: 0,
                        timeSpent: newSession.totalTimeSpent,
                        previewText: newSession.initialQuestion
                    };

                    set((state) => ({
                        sessions: [sessionSummary, ...state.sessions],
                        currentSession: newSession
                    }));

                    // Add creation event
                    get().addEvent({
                        id: crypto.randomUUID(),
                        sessionId: newSession.id,
                        type: 'created',
                        data: { title: newSession.title },
                        timestamp: new Date()
                    });

                    return newSession;
                },

                updateSession: (sessionId, updates) => {
                    set((state) => {
                        const updatedSession = state.currentSession?.id === sessionId
                            ? { ...state.currentSession, ...updates, updatedAt: new Date() }
                            : state.currentSession;

                        const updatedSessions = state.sessions.map(summary =>
                            summary.id === sessionId
                                ? {
                                    ...summary,
                                    title: updates.title || summary.title,
                                    status: updates.status || summary.status,
                                    lastAccessed: updates.lastAccessedAt || summary.lastAccessed,
                                    progress: updates.currentPhase?.progress || summary.progress
                                }
                                : summary
                        );

                        return {
                            currentSession: updatedSession,
                            sessions: updatedSessions
                        };
                    });
                },

                deleteSession: (sessionId) => {
                    set((state) => ({
                        sessions: state.sessions.filter(s => s.id !== sessionId),
                        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
                    }));
                },

                // Session list management
                setSessions: (sessions) => set({ sessions }),

                refreshSessions: async () => {
                    // This would typically fetch from the repository
                    // For now, it's a placeholder
                    set({ isLoading: false });
                },

                // Dialogue operations
                addMessage: (message) => {
                    set((state) => {
                        if (!state.currentSession) return state;

                        const updatedSession = {
                            ...state.currentSession,
                            dialogueHistory: [...state.currentSession.dialogueHistory, message],
                            updatedAt: new Date()
                        };

                        return { currentSession: updatedSession };
                    });

                    // Add message event
                    get().addEvent({
                        id: crypto.randomUUID(),
                        sessionId: get().currentSession!.id,
                        type: 'message_sent',
                        data: { role: message.role, contentLength: message.content.length },
                        timestamp: new Date()
                    });
                },

                updateMessage: (messageId, updates) => {
                    set((state) => {
                        if (!state.currentSession) return state;

                        const updatedDialogue = state.currentSession.dialogueHistory.map(msg =>
                            msg.id === messageId ? { ...msg, ...updates } : msg
                        );

                        return {
                            currentSession: {
                                ...state.currentSession,
                                dialogueHistory: updatedDialogue,
                                updatedAt: new Date()
                            }
                        };
                    });
                },

                clearDialogue: () => {
                    set((state) => {
                        if (!state.currentSession) return state;

                        return {
                            currentSession: {
                                ...state.currentSession,
                                dialogueHistory: [],
                                updatedAt: new Date()
                            }
                        };
                    });
                },

                // Dialogue UI state
                setIsTyping: (typing) => set({ isTyping: typing }),
                setPendingMessage: (message) => set({ pendingMessage: message }),

                // Phase management
                advancePhase: () => {
                    set((state) => {
                        if (!state.currentSession) return state;

                        const currentPhase = state.currentSession.currentPhase.name;
                        let nextPhase: ResearchSession['currentPhase']['name'];

                        switch (currentPhase) {
                            case 'direction_finding':
                                nextPhase = 'tree_building';
                                break;
                            case 'tree_building':
                                nextPhase = 'synthesizing';
                                break;
                            case 'synthesizing':
                                nextPhase = 'completed';
                                break;
                            default:
                                return state; // Already completed
                        }

                        const updatedSession = {
                            ...state.currentSession,
                            status: nextPhase as ResearchSession['status'],
                            currentPhase: {
                                name: nextPhase,
                                startedAt: new Date(),
                                progress: 0,
                                completedAt: nextPhase === 'completed' ? new Date() : undefined
                            },
                            updatedAt: new Date()
                        };

                        return { currentSession: updatedSession };
                    });

                    // Add phase change event
                    const session = get().currentSession;
                    if (session) {
                        get().addEvent({
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            type: 'phase_changed',
                            data: { newPhase: session.currentPhase.name },
                            timestamp: new Date()
                        });
                    }
                },

                setPhaseProgress: (progress) => {
                    set((state) => {
                        if (!state.currentSession) return state;

                        return {
                            currentSession: {
                                ...state.currentSession,
                                currentPhase: {
                                    ...state.currentSession.currentPhase,
                                    progress: Math.min(100, Math.max(0, progress))
                                },
                                updatedAt: new Date()
                            }
                        };
                    });
                },

                // Preferences
                updatePreferences: (updates) => {
                    set((state) => {
                        if (!state.currentSession) return state;

                        return {
                            currentSession: {
                                ...state.currentSession,
                                preferences: {
                                    ...state.currentSession.preferences,
                                    ...updates
                                },
                                updatedAt: new Date()
                            }
                        };
                    });
                },

                // Events
                addEvent: (event) => {
                    set((state) => ({
                        recentEvents: [event, ...state.recentEvents].slice(0, 50) // Keep last 50 events
                    }));
                },

                // UI state
                setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
                setActiveTab: (tab) => set({ activeTab: tab }),

                // Loading states
                setLoading: (loading) => set({ isLoading: loading }),
                setSaving: (saving) => set({ isSaving: saving }),
                setError: (error) => set({ error }),

                // Computed getters
                getCurrentPhase: () => {
                    const session = get().currentSession;
                    return session?.currentPhase.name || 'direction_finding';
                },

                getSessionProgress: () => {
                    const session = get().currentSession;
                    return session?.currentPhase.progress || 0;
                },

                getRecentMessages: (limit = 10) => {
                    const session = get().currentSession;
                    if (!session) return [];

                    return session.dialogueHistory
                        .slice(-limit)
                        .reverse();
                },

                canAdvancePhase: () => {
                    const session = get().currentSession;
                    if (!session) return false;

                    const phase = session.currentPhase;
                    return phase.progress >= 80 && phase.name !== 'completed';
                }
            }),
            {
                name: 'session-store',
                partialize: (state) => ({
                    sidebarCollapsed: state.sidebarCollapsed,
                    activeTab: state.activeTab
                })
            }
        ),
        {
            name: 'session-store',
        }
    )
);
