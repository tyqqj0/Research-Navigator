/**
 * 📚 Literature List Example - 演示新架构的使用方式
 * 
 * 这个示例展示了如何使用新的分层架构：
 * 1. 组件只负责UI渲染和用户交互
 * 2. 使用useLiteratureOperations Hook获取数据和操作方法
 * 3. Hook负责业务编排和UI状态管理
 * 4. Store负责纯粹的数据存储
 */

import React, { useEffect } from 'react';
import { useLiteratureOperations } from '../../data-access/hooks';

interface LiteratureListExampleProps {
    userId: string;
}

export const LiteratureListExample: React.FC<LiteratureListExampleProps> = ({ userId }) => {
    // 🪝 使用新架构的Operations Hook
    const {
        // 📚 数据状态
        literatures,
        selectedLiteratures,

        // 🔍 搜索状态
        searchState,

        // 📊 UI状态
        uiState,

        // 📈 统计信息
        stats,

        // 🔧 操作方法
        setCurrentUser,
        loadLiteratures,
        createLiterature,
        deleteLiterature,
        search,
        selectLiterature,
        clearSelection,
        setViewMode,
        clearError,
    } = useLiteratureOperations();

    // 🔄 初始化：设置用户并加载数据
    useEffect(() => {
        setCurrentUser(userId);
        loadLiteratures(userId);
    }, [userId, setCurrentUser, loadLiteratures]);

    // 🔍 搜索处理
    const handleSearch = (query: string) => {
        search(query, {
            filter: { status: 'unread' },
            sort: { field: 'createdAt', order: 'desc' },
        });
    };

    // ➕ 创建文献
    const handleCreate = async () => {
        try {
            await createLiterature({
                title: '新文献',
                authors: ['作者1'],
                abstract: '这是一个示例文献',
                tags: ['示例'],
                readingStatus: 'unread',
            });
        } catch (error) {
            console.error('创建失败:', error);
        }
    };

    // 🗑️ 删除选中的文献
    const handleDeleteSelected = async () => {
        if (selectedLiteratures.length === 0) return;

        try {
            const lids = selectedLiteratures.map(lit => lit.literature.paperId);
            await Promise.all(lids.map(paperId => deleteLiterature(paperId, userId)));
            clearSelection();
        } catch (error) {
            console.error('删除失败:', error);
        }
    };

    return (
        <div className="literature-list-example">
            {/* 📊 状态信息 */}
            <div className="status-bar">
                <div>总计: {stats.total} 篇文献</div>
                <div>已选择: {stats.selected} 篇</div>
                {uiState.isLoading && <div>加载中...</div>}
                {uiState.error && (
                    <div className="error">
                        错误: {uiState.error}
                        <button onClick={clearError}>清除</button>
                    </div>
                )}
            </div>

            {/* 🔍 搜索栏 */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="搜索文献..."
                    value={searchState.query}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                <div>
                    搜索结果: {searchState.total} 条
                    {searchState.hasMore && <span> (还有更多)</span>}
                </div>
            </div>

            {/* 🎨 工具栏 */}
            <div className="toolbar">
                <button onClick={handleCreate}>
                    ➕ 创建文献
                </button>

                <button
                    onClick={handleDeleteSelected}
                    disabled={selectedLiteratures.length === 0}
                >
                    🗑️ 删除选中 ({selectedLiteratures.length})
                </button>

                <select
                    value={uiState.viewMode}
                    onChange={(e) => setViewMode(e.target.value as any)}
                >
                    <option value="list">列表视图</option>
                    <option value="grid">网格视图</option>
                    <option value="table">表格视图</option>
                </select>
            </div>

            {/* 📚 文献列表 */}
            <div className={`literature-list ${uiState.viewMode}`}>
                {(searchState.query ? searchState.results : literatures).map((item) => (
                    <div
                        key={item.literature.paperId}
                        className={`literature-item ${uiState.selectedIds.has(item.literature.paperId) ? 'selected' : ''
                            }`}
                        onClick={() => selectLiterature(item.literature.paperId)}
                    >
                        <h3>{item.literature.title}</h3>
                        <p>作者: {item.literature.authors.join(', ')}</p>
                        <p>状态: {item.userMeta?.readingStatus || '未设置'}</p>
                        <p>标签: {item.userMeta?.tags?.join(', ') || '无'}</p>
                        {uiState.loadingIds.has(item.literature.paperId) && (
                            <div className="loading">处理中...</div>
                        )}
                    </div>
                ))}
            </div>

            {/* 📊 统计面板 */}
            <div className="stats-panel">
                <h4>统计信息</h4>
                <div>上次更新: {stats.lastUpdated?.toLocaleString() || '未更新'}</div>
                <div>加载状态: {uiState.isLoading ? '加载中' : '已完成'}</div>
                <div>搜索状态: {uiState.isSearching ? '搜索中' : '空闲'}</div>
            </div>
        </div>
    );
};

export default LiteratureListExample;


