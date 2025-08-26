import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind CSS 类名，支持条件类名和去重
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const dateObj = new Date(date);
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    return new Intl.DateTimeFormat('zh-CN', { ...defaultOptions, ...options }).format(dateObj);
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date | string | number): string {
    const now = new Date();
    const targetDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return '刚刚';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}分钟前`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours}小时前`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays}天前`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks}周前`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return `${diffInMonths}个月前`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}年前`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);

    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * 生成随机ID
 */
export function generateId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}-${timestamp}-${randomStr}` : `${timestamp}-${randomStr}`;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
        const clonedObj = {} as T;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }

    return obj;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };

        const callNow = immediate && !timeout;

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func(...args);
    };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T>(str: string, fallback?: T): T | null {
    try {
        return JSON.parse(str);
    } catch {
        return fallback ?? null;
    }
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 检查是否为有效的URL
 */
export function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

/**
 * 检查是否为有效的邮箱
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * 从文件名获取MIME类型
 */
export function getMimeType(filename: string): string {
    const ext = getFileExtension(filename);
    const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        json: 'application/json',
        csv: 'text/csv',
        xml: 'application/xml',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        zip: 'application/zip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 计算文本相似度（简单的余弦相似度）
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
    const getWordFreq = (text: string) => {
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        const freq: Record<string, number> = {};
        words.forEach(word => {
            freq[word] = (freq[word] || 0) + 1;
        });
        return freq;
    };

    const freq1 = getWordFreq(text1);
    const freq2 = getWordFreq(text2);

    const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    allWords.forEach(word => {
        const f1 = freq1[word] || 0;
        const f2 = freq2[word] || 0;

        dotProduct += f1 * f2;
        norm1 += f1 * f1;
        norm2 += f2 * f2;
    });

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * 高亮搜索关键词
 */
export function highlightText(text: string, searchTerm: string): string {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

/**
 * 数组分组
 */
export function groupBy<T, K extends string | number | symbol>(
    array: T[],
    keyFunc: (item: T) => K
): Record<K, T[]> {
    return array.reduce((groups, item) => {
        const key = keyFunc(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {} as Record<K, T[]>);
}

/**
 * 数组去重
 */
export function uniqueBy<T, K>(array: T[], keyFunc: (item: T) => K): T[] {
    const seen = new Set<K>();
    return array.filter(item => {
        const key = keyFunc(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * 排序函数
 */
export function sortBy<T>(
    array: T[],
    keyFunc: (item: T) => string | number,
    direction: 'asc' | 'desc' = 'asc'
): T[] {
    return [...array].sort((a, b) => {
        const aVal = keyFunc(a);
        const bVal = keyFunc(b);

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * 获取嵌套对象属性值
 */
export function get(obj: Record<string, unknown>, path: string, defaultValue?: unknown): unknown {
    const keys = path.split('.');
    let result: unknown = obj;

    for (const key of keys) {
        if (result == null || typeof result !== 'object') {
            return defaultValue;
        }
        result = (result as Record<string, unknown>)[key];
    }

    return result !== undefined ? result : defaultValue;
}

/**
 * 设置嵌套对象属性值
 */
export function set(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
}
