'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityItem } from "@/components/ui/activity-item";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatCard } from "@/components/ui/stat-card";
import { useThemeCompat } from "@/providers";
import { Search, FileText, Users, Settings, Activity, Zap } from "lucide-react";
import { EnhancedThemeSelector } from './enhanced-theme-selector';
import { CSSClassSystemDemo } from './css-class-system-demo';

export default function ThemeTestPage() {
    const { setTheme, currentTheme, userTheme } = useThemeCompat();

    return (
        <div className="space-y-12">
            {/* 临时移除动态演示 */}
            {/* <DynamicThemeDemo /> */}

            {/* 原有的测试内容 */}
            <div className="container mx-auto p-8 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>主题测试页面</CardTitle>
                        <CardDescription>
                            当前主题: {currentTheme} | 用户设置: {userTheme}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 增强的主题设置器 */}
                        <EnhancedThemeSelector />

                        {/* 调试信息 */}
                        {/* <DebugColors /> */}

                        {/* 实时CSS变量检测 */}
                        {/* <TestCSSVars /> */}

                        {/* CSS变量DOM检测 */}
                        {/* <CSSDebug /> */}

                        {/* 主题映射调试 */}
                        {/* <ThemeMappingDebug /> */}

                        {/* Tailwind CSS调试 */}
                        {/* <TailwindDebug /> */}

                        {/* HSL转换测试 */}
                        {/* <HSLConversionTest /> */}

                        {/* 原始HSL测试 */}
                        {/* <TestHSL /> */}




                    </CardContent>
                </Card>

                {/* 🔍 主题流程测试 */}
                {/* <Card>
                    <CardHeader>
                        <CardTitle>🔍 主题系统流程测试</CardTitle>
                        <CardDescription>
                            验证完整的主题切换流程：配置 → Provider → CSS变量 → Tailwind → UI
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FlowTest />
                    </CardContent>
                </Card> */}

                {/* 🎨 颜色主题测试 */}
                {/* <ColorThemeTest /> */}

                {/* 🧪 Tailwind运行时测试 */}
                {/* <TailwindRuntimeTest /> */}

                {/* 🛠️ Tailwind修复方案 */}
                {/* <TailwindFixDemo /> */}

                {/* 🔄 Tailwind动态方案探索 */}
                {/* <TailwindDynamicSolutions /> */}

                {/* 🏗️ 架构重构方案 */}
                {/* <ArchitectureRefactorPlan /> */}

                {/* 🎨 CSS类系统演示 */}
                <CSSClassSystemDemo />

                {/* 🎉 最终重构总结 */}
                {/* <FinalRefactorSummary /> */}
            </div>
        </div>
    );
}
