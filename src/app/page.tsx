"use client";

import React, { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOAuth } from '@autolabz/oauth-sdk';
import { Button } from '@/components/ui/button';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, accessToken, startLogin } = (() => {
    try { return useOAuth(); } catch { return { isAuthenticated: false, accessToken: undefined, startLogin: async () => { } } as any; }
  })();

  useEffect(() => {
    // 已登录用户自动跳转到主应用
    const hasToken = typeof accessToken === 'string' && accessToken.length > 0;
    if (isAuthenticated && hasToken) {
      router.replace('/research');
    }
  }, [isAuthenticated, accessToken, router]);

  const redirectUri = useMemo(() => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || `${window.location.origin}/oauth-app/callback`;
    }
    return process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || '/oauth-app/callback';
  }, []);

  const handleStart = useCallback(async () => {
    await startLogin({
      redirectUri,
      scope: process.env.NEXT_PUBLIC_OAUTH_SCOPE || 'openid profile email',
      usePkce: true,
    });
  }, [redirectUri, startLogin]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6 py-16 md:py-24">
        <div className="max-w-5xl w-full">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-20"></div>
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <svg className="w-16 h-16 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Hero Content */}
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Semantic DeepResearch
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              智能研究助手：发现、管理与分析学术文献
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <span className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-200 dark:border-blue-800">
                📚 文献管理
              </span>
              <span className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium border border-purple-200 dark:border-purple-800">
                🤖 AI 辅助
              </span>
              <span className="px-4 py-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium border border-green-200 dark:border-green-800">
                🔍 智能检索
              </span>
            </div>

            {/* CTA Button */}
            <div className="flex items-center justify-center gap-4 pt-8">
              <Button
                size="lg"
                className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                onClick={handleStart}
              >
                开始使用
              </Button>
            </div>

            {/* Subtle Description */}
            <p className="text-sm text-slate-500 dark:text-slate-500 pt-6 max-w-md mx-auto">
              使用学术账号登录，开启您的研究之旅
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto text-center text-sm text-slate-500 dark:text-slate-500">
          © 2025 Research Navigator. All rights reserved.
        </div>
      </footer>
    </div>
  );
}