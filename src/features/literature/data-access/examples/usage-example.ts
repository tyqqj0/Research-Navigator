/**
 * 📚 新架构使用示例 - 展示可组合数据设计的优势
 * 
 * 这个文件展示了优化后架构的使用方式，突出以下特点：
 * 1. 统一的数据接口 - 只需要操作组合后的数据
 * 2. 空文献支持 - 支持临时状态和自动解析
 * 3. 类型安全 - 完整的TypeScript支持
 * 4. 响应式更新 - 自动同步UI状态
 */

import { useUnifiedLiteratureStore } from '../stores/unified-literature-store';
import { compositionService } from '../services/composition-service';

// ==================== 组件使用示例 ====================

/**
 * 📚 文献列表组件示例
 */
export function LiteratureListExample() {
    // ✅ 只需要一个Store，获取所有需要的数据
    const {
        getAllLiteratures,
        getUserLiteratures,
        createLiterature,
        updateUserMeta,
        search,
        loading,
        error,
    } = useUnifiedLiteratureStore();

    // ✅ 获取当前用户的所有文献（已经组合了用户元数据）
    const userLiteratures = getUserLiteratures();

    // ✅ 每个文献都包含完整的信息，无需额外查询
    const handleRenderLiterature = (literature) => {
        // 文献基础信息
        console.log('Title:', literature.title);
        console.log('Authors:', literature.authors);
        console.log('Year:', literature.year);

        // 用户元数据（如果存在）
        if (literature.userMeta) {
            console.log('Tags:', literature.userMeta.tags);
            console.log('Reading Status:', literature.userMeta.readingStatus);
            console.log('Rating:', literature.userMeta.rating);
        }

        // 引文统计
        console.log('Citations:', literature.citationStats.totalCitations);

        // 相关文献
        console.log('Related Items:', literature.relatedItems);
    };

    // ✅ 简单的用户操作
    const handleAddTag = async (lid: string, newTag: string) => {
        const literature = useUnifiedLiteratureStore.getState().getLiterature(lid);
        if (literature?.userMeta) {
            const currentTags = literature.userMeta.tags || [];
            await updateUserMeta(lid, {
                tags: [...currentTags, newTag]
            });
        }
    };

    // ✅ 创建空文献，支持URL自动解析
    const handleAddFromUrl = async (url: string) => {
        const newLiterature = await createLiterature({
            url,
            autoParseUrl: true, // 自动解析URL
        });

        console.log('Created empty literature:', newLiterature.lid);
        // URL解析会在后台进行，UI会自动更新
    };

    return {
        userLiteratures,
        handleRenderLiterature,
        handleAddTag,
        handleAddFromUrl,
        loading: loading.global,
        error: error.global,
    };
}

// ==================== 空文献支持示例 ====================

/**
 * ✨ 空文献工作流示例
 */
export async function emptyLiteratureWorkflowExample() {
    console.log('=== 空文献工作流示例 ===');

    // 1. 用户输入一个URL，创建空文献
    const emptyLit = await compositionService.createEmptyLiterature({
        title: '待解析文献',
        url: 'https://arxiv.org/abs/2301.00001',
        userId: 'user-123',
    });

    console.log('✅ 创建空文献:', {
        lid: emptyLit.lid,
        status: emptyLit.status, // 'empty'
        title: emptyLit.title,
        url: emptyLit.url,
    });

    // 2. 模拟后端解析完成，填充真实数据
    const filledLit = await compositionService.fillEmptyLiterature(emptyLit.lid, {
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
        year: 2017,
        abstract: 'The dominant sequence transduction models...',
        doi: '10.48550/arXiv.1706.03762',
        status: 'active',
    });

    console.log('✅ 填充文献数据:', {
        lid: filledLit?.lid,
        status: filledLit?.status, // 'active'
        title: filledLit?.title,
        authors: filledLit?.authors,
    });

    // 3. 用户添加个人元数据
    if (filledLit?.userMeta) {
        console.log('✅ 用户元数据已存在:', {
            tags: filledLit.userMeta.tags,
            readingStatus: filledLit.userMeta.readingStatus,
        });
    }
}

// ==================== 数据组合示例 ====================

/**
 * 🔄 数据组合服务使用示例
 */
export async function compositionServiceExample() {
    console.log('=== 数据组合服务示例 ===');

    // 1. 组合单个文献（包含用户元数据和引文统计）
    const enhancedLit = await compositionService.composeSingle('lit-123', {
        userId: 'user-123',
        includeUserMeta: true,
        includeCitationStats: true,
        includeRelatedItems: true,
    });

    if (enhancedLit) {
        console.log('✅ 组合后的文献数据:', {
            // 核心文献数据
            title: enhancedLit.title,
            authors: enhancedLit.authors,

            // 用户元数据
            userTags: enhancedLit.userMeta?.tags,
            readingStatus: enhancedLit.userMeta?.readingStatus,

            // 引文统计
            citations: enhancedLit.citationStats.totalCitations,

            // 相关文献
            relatedCount: enhancedLit.relatedItems.length,
        });
    }

    // 2. 批量组合用户的所有文献
    const userLiteratures = await compositionService.composeForUser('user-123');
    console.log('✅ 用户文献数量:', userLiteratures.length);

    // 3. 批量组合指定文献
    const batchLiteratures = await compositionService.composeBatch(
        ['lit-1', 'lit-2', 'lit-3'],
        {
            userId: 'user-123',
            includeUserMeta: true,
            includeCitationStats: false, // 可选择性包含
        }
    );
    console.log('✅ 批量组合文献数量:', batchLiteratures.length);
}

// ==================== Store使用示例 ====================

/**
 * 🏪 Store使用最佳实践
 */
export function storeUsageBestPractices() {
    const store = useUnifiedLiteratureStore();

    // ✅ 初始化用户数据
    const initializeUser = async (userId: string) => {
        await store.initialize(userId);
        console.log('用户数据初始化完成');
    };

    // ✅ 创建文献的不同方式
    const createLiteratureExamples = {
        // 手动创建
        manual: () => store.createLiterature({
            title: '手动添加的文献',
            authors: ['Author Name'],
        }),

        // 从URL创建（自动解析）
        fromUrl: () => store.createLiterature({
            url: 'https://example.com/paper.pdf',
            autoParseUrl: true,
        }),

        // 临时文献（稍后填充）
        temporary: () => store.createLiterature({
            title: '临时文献标题',
        }),
    };

    // ✅ 搜索和过滤
    const searchExamples = {
        // 基础搜索
        basic: () => store.search('machine learning'),

        // 带过滤的搜索
        withFilter: () => store.search('neural networks', {
            yearRange: { start: 2020, end: 2024 },
            hasAbstract: true,
        }),

        // 带排序的搜索
        withSort: () => store.search('deep learning', undefined, {
            field: 'year',
            order: 'desc',
        }),
    };

    // ✅ 数据访问
    const dataAccess = {
        // 获取所有文献
        all: () => store.getAllLiteratures(),

        // 获取用户文献
        user: () => store.getUserLiteratures(),

        // 获取特定文献
        specific: (lid: string) => store.getLiterature(lid),

        // 获取搜索结果
        search: () => store.searchResults,
    };

    return {
        initializeUser,
        createLiteratureExamples,
        searchExamples,
        dataAccess,
    };
}

// ==================== 类型安全示例 ====================

/**
 * 🛡️ 类型安全使用示例
 */
export function typeSafetyExample() {
    const literature = useUnifiedLiteratureStore.getState().getLiterature('lit-123');

    if (literature) {
        // ✅ TypeScript 完全支持
        const title: string = literature.title;
        const authors: string[] = literature.authors;
        const year: number | undefined = literature.year;

        // ✅ 用户元数据的类型检查
        if (literature.userMeta) {
            const tags: string[] = literature.userMeta.tags;
            const status: 'unread' | 'reading' | 'completed' | 'referenced' | 'abandoned' =
                literature.userMeta.readingStatus;
        }

        // ✅ 引文统计的类型检查
        const citationCount: number = literature.citationStats.totalCitations;

        // ✅ 状态检查
        if (literature.status === 'empty') {
            console.log('这是一个空文献，等待填充数据');
        }

        return {
            title,
            authors,
            year,
            isComplete: literature.status === 'active',
            hasUserData: !!literature.userMeta,
            citationCount,
        };
    }

    return null;
}

// ==================== 导出示例函数 ====================

export const examples = {
    LiteratureListExample,
    emptyLiteratureWorkflowExample,
    compositionServiceExample,
    storeUsageBestPractices,
    typeSafetyExample,
};
