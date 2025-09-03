/**
 * 🔗 Citation Service - 简化版引用服务
 * 
 * 新架构: 后端处理复杂分析，前端负责缓存和展示
 * 核心功能: 引用网络获取、关系分析、可视化数据准备
 */

import { backendApiService, CitationNetworkResult } from './backend-api-service';
import { literatureDomainRepositories } from '../repositories';
import { CitationRelation, CitationNetwork, CitationAnalytics } from '../types';

/**
 * 🔗 简化版 Citation Service
 * 
 * 设计原则：
 * 1. 引用分析由后端AI完成
 * 2. 前端负责数据缓存和可视化
 * 3. 支持增量更新和实时刷新
 */
export class SimplifiedCitationService {
  constructor(
    private readonly backendApi = backendApiService,
    private readonly citationRepo = literatureDomainRepositories.citation
  ) {}

  // ==================== 引用网络获取 ====================

  /**
   * 🕸️ 获取引用网络 - 后端分析
   */
  async getCitationNetwork(
    literatureIds: string[],
    options: {
      maxDepth?: number;
      includeExternal?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<CitationNetwork> {
    try {
      console.log(`[CitationService] Getting citation network for ${literatureIds.length} items`);

      // 🌐 从后端获取引用网络
      const networkResult = await this.backendApi.getCitationNetwork(literatureIds);

      // 💾 同步到本地缓存
      await this.syncCitationsToCache(networkResult.citations.map(citation => ({
        id: `${citation.sourceLid}-${citation.targetLid}`,
        sourceLiteratureId: citation.sourceLid,
        targetLiteratureId: citation.targetLid,
        citationType: citation.citationType as 'direct' | 'indirect' | 'self',
        confidence: citation.confidence,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      })));

      // 📊 构建网络图数据结构
      const network: CitationNetwork = {
        nodes: networkResult.lids.map(lid => ({
          id: lid,
          literatureId: lid,
          label: lid, // 可以后续从文献数据获取标题
          type: 'literature',
          metadata: {}
        })),
        edges: networkResult.citations.map(citation => ({
          id: `${citation.sourceLid}-${citation.targetLid}`,
          source: citation.sourceLid,
          target: citation.targetLid,
          type: citation.citationType,
          weight: citation.confidence,
          metadata: {
            confidence: citation.confidence
          }
        })),
        metadata: {
          totalNodes: networkResult.metadata.totalNodes,
          totalEdges: networkResult.metadata.totalEdges,
          analysisTime: networkResult.metadata.analysisTime,
          generatedAt: new Date(),
          algorithm: 'backend-ai'
        }
      };

      console.log(`[CitationService] Generated network with ${network.nodes.length} nodes and ${network.edges.length} edges`);
      return network;

    } catch (error) {
      console.error('[CitationService] Get citation network failed:', error);
      throw new Error('Failed to get citation network');
    }
  }

  /**
   * 🎯 获取单个文献的引用关系
   */
  async getLiteratureCitations(
    literatureId: string,
    options: {
      includeIncoming?: boolean;
      includeOutgoing?: boolean;
      limit?: number;
    } = { includeIncoming: true, includeOutgoing: true }
  ): Promise<{
    incoming: CitationRelation[];
    outgoing: CitationRelation[];
    stats: {
      totalIncoming: number;
      totalOutgoing: number;
      totalCitations: number;
    };
  }> {
    try {
      console.log(`[CitationService] Getting citations for literature: ${literatureId}`);

      // 🌐 从后端获取引用关系
      const citationResult = await this.backendApi.getLiteratureCitations(literatureId);

      // 🔄 转换为前端数据格式
      const incoming: CitationRelation[] = citationResult.incoming.map(citation => ({
        id: `${citation.sourceLid}-${literatureId}`,
        sourceLiteratureId: citation.sourceLid,
        targetLiteratureId: literatureId,
        citationType: citation.citationType as 'direct' | 'indirect' | 'self',
        confidence: citation.confidence,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const outgoing: CitationRelation[] = citationResult.outgoing.map(citation => ({
        id: `${literatureId}-${citation.targetLid}`,
        sourceLiteratureId: literatureId,
        targetLiteratureId: citation.targetLid,
        citationType: citation.citationType as 'direct' | 'indirect' | 'self',
        confidence: citation.confidence,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // 💾 同步到本地缓存
      await this.syncCitationsToCache([...incoming, ...outgoing]);

      return {
        incoming,
        outgoing,
        stats: {
          totalIncoming: incoming.length,
          totalOutgoing: outgoing.length,
          totalCitations: citationResult.total
        }
      };

    } catch (error) {
      console.error('[CitationService] Get literature citations failed:', error);
      throw new Error('Failed to get literature citations');
    }
  }

  // ==================== 引用分析 ====================

  /**
   * 📊 获取引用分析报告
   */
  async getCitationAnalytics(
    literatureIds: string[]
  ): Promise<CitationAnalytics> {
    try {
      console.log(`[CitationService] Analyzing citations for ${literatureIds.length} items`);

      // 🕸️ 获取完整网络
      const network = await this.getCitationNetwork(literatureIds);

      // 📈 计算网络指标
      const analytics: CitationAnalytics = {
        networkMetrics: {
          totalNodes: network.nodes.length,
          totalEdges: network.edges.length,
          density: this.calculateNetworkDensity(network),
          averageDegree: this.calculateAverageDegree(network),
          clusteringCoefficient: 0, // 可以实现更复杂的算法
          centralityMeasures: this.calculateCentralityMeasures(network)
        },
        topCitedLiterature: this.getTopCitedLiterature(network, 10),
        citationPatterns: this.analyzeCitationPatterns(network),
        temporalTrends: [], // 需要时间数据支持
        recommendations: this.generateCitationRecommendations(network),
        generatedAt: new Date()
      };

      return analytics;

    } catch (error) {
      console.error('[CitationService] Get citation analytics failed:', error);
      throw new Error('Failed to get citation analytics');
    }
  }

  /**
   * 🎯 获取推荐引用
   */
  async getRecommendedCitations(
    baseLiteratureId: string,
    limit: number = 10
  ): Promise<Array<{
    literatureId: string;
    score: number;
    reason: string;
    confidence: number;
  }>> {
    try {
      console.log(`[CitationService] Getting recommended citations for: ${baseLiteratureId}`);

      // 🕸️ 获取当前文献的引用网络
      const network = await this.getCitationNetwork([baseLiteratureId], {
        maxDepth: 2
      });

      // 🤖 基于网络结构生成推荐
      const recommendations = this.generateNetworkBasedRecommendations(
        network, 
        baseLiteratureId, 
        limit
      );

      return recommendations;

    } catch (error) {
      console.error('[CitationService] Get recommended citations failed:', error);
      throw new Error('Failed to get recommended citations');
    }
  }

  // ==================== 可视化数据准备 ====================

  /**
   * 🎨 为可视化准备网络数据
   */
  async prepareVisualizationData(
    literatureIds: string[],
    layoutType: 'force' | 'hierarchical' | 'circular' = 'force'
  ): Promise<{
    nodes: Array<{
      id: string;
      label: string;
      size: number;
      color: string;
      group: string;
      metadata: any;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      weight: number;
      color: string;
      type: string;
    }>;
    layout: {
      type: string;
      options: any;
    };
  }> {
    try {
      console.log(`[CitationService] Preparing visualization data for ${literatureIds.length} items`);

      // 🕸️ 获取网络数据
      const network = await this.getCitationNetwork(literatureIds);

      // 📊 计算节点指标
      const nodeDegrees = this.calculateNodeDegrees(network);
      const maxDegree = Math.max(...Object.values(nodeDegrees));

      // 🎨 准备可视化节点
      const visualNodes = network.nodes.map(node => ({
        id: node.id,
        label: node.label,
        size: Math.max(5, (nodeDegrees[node.id] / maxDegree) * 30), // 根据度数调整大小
        color: this.getNodeColor(node, nodeDegrees[node.id]),
        group: this.getNodeGroup(node, network),
        metadata: {
          degree: nodeDegrees[node.id],
          ...node.metadata
        }
      }));

      // 🔗 准备可视化边
      const visualEdges = network.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight || 1,
        color: this.getEdgeColor(edge),
        type: edge.type
      }));

      // 📐 布局配置
      const layoutOptions = this.getLayoutOptions(layoutType, visualNodes.length);

      return {
        nodes: visualNodes,
        edges: visualEdges,
        layout: {
          type: layoutType,
          options: layoutOptions
        }
      };

    } catch (error) {
      console.error('[CitationService] Prepare visualization data failed:', error);
      throw new Error('Failed to prepare visualization data');
    }
  }

  // ==================== 私有工具方法 ====================

  /**
   * 💾 同步引用关系到本地缓存
   */
  private async syncCitationsToCache(citations: CitationRelation[]): Promise<void> {
    try {
      for (const citation of citations) {
        const existing = await this.citationRepo.findById(citation.id);
        
        if (existing) {
          await this.citationRepo.update(citation.id, citation);
        } else {
          await this.citationRepo.create(citation);
        }
      }

      console.log(`[CitationService] Synced ${citations.length} citations to cache`);
    } catch (error) {
      console.warn('[CitationService] Sync citations to cache failed:', error);
      // 不抛出错误，因为这只是缓存操作
    }
  }

  /**
   * 📊 计算网络密度
   */
  private calculateNetworkDensity(network: CitationNetwork): number {
    const n = network.nodes.length;
    if (n <= 1) return 0;
    
    const maxEdges = n * (n - 1); // 有向图
    return network.edges.length / maxEdges;
  }

  /**
   * 📊 计算平均度数
   */
  private calculateAverageDegree(network: CitationNetwork): number {
    if (network.nodes.length === 0) return 0;
    
    const degrees = this.calculateNodeDegrees(network);
    const totalDegree = Object.values(degrees).reduce((sum, degree) => sum + degree, 0);
    
    return totalDegree / network.nodes.length;
  }

  /**
   * 📊 计算节点度数
   */
  private calculateNodeDegrees(network: CitationNetwork): Record<string, number> {
    const degrees: Record<string, number> = {};
    
    // 初始化所有节点度数为0
    network.nodes.forEach(node => {
      degrees[node.id] = 0;
    });

    // 计算度数
    network.edges.forEach(edge => {
      degrees[edge.source] = (degrees[edge.source] || 0) + 1;
      degrees[edge.target] = (degrees[edge.target] || 0) + 1;
    });

    return degrees;
  }

  /**
   * 📊 计算中心性指标
   */
  private calculateCentralityMeasures(network: CitationNetwork): Record<string, number> {
    // 简化版本，只计算度中心性
    const degrees = this.calculateNodeDegrees(network);
    const maxDegree = Math.max(...Object.values(degrees));
    
    const centrality: Record<string, number> = {};
    Object.entries(degrees).forEach(([nodeId, degree]) => {
      centrality[nodeId] = maxDegree > 0 ? degree / maxDegree : 0;
    });

    return centrality;
  }

  /**
   * 🏆 获取被引用最多的文献
   */
  private getTopCitedLiterature(network: CitationNetwork, limit: number): Array<{
    literatureId: string;
    citationCount: number;
    rank: number;
  }> {
    const incomingCounts: Record<string, number> = {};
    
    // 计算入度（被引用次数）
    network.edges.forEach(edge => {
      incomingCounts[edge.target] = (incomingCounts[edge.target] || 0) + 1;
    });

    // 排序并返回前N个
    return Object.entries(incomingCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([literatureId, citationCount], index) => ({
        literatureId,
        citationCount,
        rank: index + 1
      }));
  }

  /**
   * 📈 分析引用模式
   */
  private analyzeCitationPatterns(network: CitationNetwork): Array<{
    pattern: string;
    count: number;
    description: string;
  }> {
    const patterns: Array<{ pattern: string; count: number; description: string }> = [];

    // 计算自引用
    const selfCitations = network.edges.filter(edge => edge.source === edge.target).length;
    if (selfCitations > 0) {
      patterns.push({
        pattern: 'self_citation',
        count: selfCitations,
        description: 'Self-citations within the network'
      });
    }

    // 计算互相引用
    const mutualCitations = this.findMutualCitations(network);
    if (mutualCitations > 0) {
      patterns.push({
        pattern: 'mutual_citation',
        count: mutualCitations,
        description: 'Papers that cite each other'
      });
    }

    return patterns;
  }

  /**
   * 🔄 查找互相引用
   */
  private findMutualCitations(network: CitationNetwork): number {
    const edgeSet = new Set(network.edges.map(edge => `${edge.source}-${edge.target}`));
    let mutualCount = 0;

    network.edges.forEach(edge => {
      const reverseEdge = `${edge.target}-${edge.source}`;
      if (edgeSet.has(reverseEdge) && edge.source < edge.target) {
        mutualCount++;
      }
    });

    return mutualCount;
  }

  /**
   * 💡 生成引用推荐
   */
  private generateCitationRecommendations(network: CitationNetwork): string[] {
    const recommendations: string[] = [];

    // 基于网络结构的推荐
    if (network.nodes.length > 10) {
      recommendations.push('Consider exploring citation clusters for research themes');
    }

    if (network.edges.length / network.nodes.length > 2) {
      recommendations.push('High citation density suggests well-connected research area');
    }

    const topCited = this.getTopCitedLiterature(network, 3);
    if (topCited.length > 0) {
      recommendations.push(`Focus on highly cited papers: ${topCited.map(item => item.literatureId).join(', ')}`);
    }

    return recommendations;
  }

  /**
   * 🎯 基于网络的推荐生成
   */
  private generateNetworkBasedRecommendations(
    network: CitationNetwork,
    baseLiteratureId: string,
    limit: number
  ): Array<{
    literatureId: string;
    score: number;
    reason: string;
    confidence: number;
  }> {
    const recommendations: Array<{
      literatureId: string;
      score: number;
      reason: string;
      confidence: number;
    }> = [];

    // 获取直接引用的文献
    const directCitations = network.edges
      .filter(edge => edge.source === baseLiteratureId)
      .map(edge => edge.target);

    // 获取被相同文献引用的文献（协同引用）
    const coCitedLiterature = network.edges
      .filter(edge => directCitations.includes(edge.source))
      .map(edge => edge.target)
      .filter(id => id !== baseLiteratureId);

    // 计算推荐分数
    const scoreMap: Record<string, { count: number; reasons: string[] }> = {};
    
    coCitedLiterature.forEach(literatureId => {
      if (!scoreMap[literatureId]) {
        scoreMap[literatureId] = { count: 0, reasons: [] };
      }
      scoreMap[literatureId].count++;
      scoreMap[literatureId].reasons.push('Co-cited by common references');
    });

    // 转换为推荐格式并排序
    Object.entries(scoreMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit)
      .forEach(([literatureId, data]) => {
        recommendations.push({
          literatureId,
          score: data.count / directCitations.length, // 归一化分数
          reason: data.reasons[0],
          confidence: Math.min(0.9, data.count / 5) // 基于共现频率的置信度
        });
      });

    return recommendations;
  }

  /**
   * 🎨 获取节点颜色
   */
  private getNodeColor(node: any, degree: number): string {
    // 基于度数的颜色映射
    if (degree > 10) return '#e74c3c'; // 红色 - 高度连接
    if (degree > 5) return '#f39c12';  // 橙色 - 中度连接
    if (degree > 2) return '#3498db';  // 蓝色 - 低度连接
    return '#95a5a6'; // 灰色 - 孤立节点
  }

  /**
   * 🔗 获取边颜色
   */
  private getEdgeColor(edge: any): string {
    // 基于引用类型的颜色
    switch (edge.type) {
      case 'direct': return '#2ecc71';    // 绿色 - 直接引用
      case 'indirect': return '#9b59b6';  // 紫色 - 间接引用
      case 'self': return '#e67e22';      // 橙色 - 自引用
      default: return '#bdc3c7';          // 灰色 - 未知类型
    }
  }

  /**
   * 👥 获取节点分组
   */
  private getNodeGroup(node: any, network: CitationNetwork): string {
    // 简单的基于连接度的分组
    const degrees = this.calculateNodeDegrees(network);
    const degree = degrees[node.id] || 0;
    
    if (degree > 10) return 'hub';
    if (degree > 5) return 'connector';
    if (degree > 2) return 'member';
    return 'peripheral';
  }

  /**
   * 📐 获取布局选项
   */
  private getLayoutOptions(layoutType: string, nodeCount: number): any {
    const baseOptions = {
      force: {
        repulsion: Math.max(100, nodeCount * 10),
        attraction: 0.1,
        damping: 0.9,
        iterations: 1000
      },
      hierarchical: {
        direction: 'UD',
        sortMethod: 'directed',
        levelSeparation: 150,
        nodeSpacing: 100
      },
      circular: {
        radius: Math.max(200, nodeCount * 5),
        startAngle: 0
      }
    };

    return baseOptions[layoutType as keyof typeof baseOptions] || baseOptions.force;
  }
}

// 🏪 单例服务实例
export const simplifiedCitationService = new SimplifiedCitationService();

