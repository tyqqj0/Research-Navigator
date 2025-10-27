"use client";

import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Card, CardContent, MessageComposer } from '@/components/ui';

export default function ChatPage() {

    const headerActions = (
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
                新对话
            </Button>
            <Button variant="outline" size="sm">
                历史记录
            </Button>
        </div>
    );

    return (
        <ProtectedLayout>
            <MainLayout
                headerTitle="AI 研究助手"
                headerActions={headerActions}
                showSidebar={true}
            >
                <div className="h-full flex flex-col">
                    {/* 聊天消息区域 */}
                    <div className="flex-1 overflow-auto p-6">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {/* AI 消息 */}
                            <div className="flex space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <Card>
                                        <CardContent className="p-4">
                                            <p className="text-sm">
                                                您好！我是您的AI研究助手。我可以帮助您：
                                            </p>
                                            <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                                                <li>分析和总结学术文献</li>
                                                <li>生成研究问题和假设</li>
                                                <li>协助文献综述写作</li>
                                                <li>解释复杂的研究方法</li>
                                                <li>提供研究建议和方向</li>
                                            </ul>
                                            <p className="text-sm mt-2">
                                                请告诉我您需要什么帮助！
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            {/* 用户消息示例 */}
                            <div className="flex space-x-3 justify-end">
                                <div className="flex-1 max-w-xs">
                                    <Card>
                                        <CardContent className="p-4 bg-blue-50 dark:bg-blue-900/20">
                                            <p className="text-sm">
                                                请帮我分析一下机器学习在医疗诊断中的应用现状
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* AI 回复 */}
                            <div className="flex space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <Card>
                                        <CardContent className="p-4">
                                            <p className="text-sm mb-3">
                                                机器学习在医疗诊断中的应用现状可以从以下几个方面来分析：
                                            </p>
                                            <div className="space-y-3 text-sm">
                                                <div>
                                                    <h4 className="font-semibold">1. 医学影像诊断</h4>
                                                    <p>深度学习在X光、CT、MRI等医学影像分析中表现出色，在某些领域已达到专家水平...</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold">2. 病理学诊断</h4>
                                                    <p>计算机视觉技术在组织病理学切片分析中显示出巨大潜力...</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold">3. 预测性分析</h4>
                                                    <p>基于电子病历数据的预测模型能够提前识别疾病风险...</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 输入区域 */}
                    <div className="border-t bg-white dark:bg-gray-900 p-4">
                        <div className="max-w-4xl mx-auto">
                            <MessageComposer
                                value={""}
                                onChange={() => { }}
                                onSend={() => { }}
                                placeholder="输入您的问题..."
                                variant="chat"
                                sendKeyScheme="enterToSend"
                                helperText={<span className="hidden md:inline">按 <b>Enter</b> 发送，<b>Shift+Enter</b> 换行</span>}
                            />
                        </div>
                    </div>
                </div>
            </MainLayout>
        </ProtectedLayout>
    );
}
