"use client";

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    onChange?: (value: string) => void;
    onClear?: () => void;
    isLoading?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    function SearchInput(
        { className, value, onChange, onClear, placeholder = '搜索...', isLoading = false, ...props },
        ref
    ) {
        const handleChange = React.useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                onChange?.(e.target.value);
            },
            [onChange]
        );

        return (
            <div className={cn('relative', className)}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={ref}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className={cn('pl-9 pr-8', isLoading ? 'cursor-progress' : undefined)}
                    {...props}
                />
                {!!value && (
                    <button
                        type="button"
                        aria-label="清除搜索"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={onClear}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                )}
            </div>
        );
    }
);


