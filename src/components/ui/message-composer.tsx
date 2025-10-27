"use client";

import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { AtSign } from "lucide-react";

export type SendKeyScheme = "enterToSend" | "modEnterToSend";

export interface MessageComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;

    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;

    variant?: "hero" | "chat";
    radius?: "lg" | "xl";
    density?: "normal" | "compact"; // default: normal
    minRows?: number;
    maxRows?: number;

    sendKeyScheme?: SendKeyScheme; // default: enterToSend

    className?: string; // wrapper
    textareaClassName?: string; // inner textarea

    leftTools?: React.ReactNode;
    rightTools?: React.ReactNode;
    leftAdornment?: React.ReactNode; // inline, inside textarea container (left)
    rightAdornment?: React.ReactNode; // inline, inside textarea container (right)
    helperText?: React.ReactNode;

    // Mentions ("@") support — optional, controlled by parent
    mentionEnabled?: boolean; // enable mention trigger and detection
    mentionOpen?: boolean; // controlled open state (optional)
    onMentionOpenChange?: (open: boolean) => void; // controlled open state change
    mentionQuery?: string; // controlled query token (optional)
    onMentionQueryChange?: (query: string) => void; // when token updates via typing '@'
    renderMentionContent?: (ctx: { value: string; setValue: (v: string) => void; close: () => void; query: string; }) => React.ReactNode; // render Popover content
    mentionTriggerTitle?: string; // tooltip/title for mention trigger
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
    value,
    onChange,
    onSend,
    placeholder,
    disabled,
    loading,
    variant = "hero",
    radius,
    density = "normal",
    minRows = 1,
    maxRows = 8,
    sendKeyScheme = "enterToSend",
    className,
    textareaClassName,
    leftTools,
    rightTools,
    leftAdornment,
    rightAdornment,
    helperText,
    mentionEnabled = false,
    mentionOpen,
    onMentionOpenChange,
    mentionQuery,
    onMentionQueryChange,
    renderMentionContent,
    mentionTriggerTitle,
}) => {
    const [isComposing, setIsComposing] = React.useState(false);
    const [internalMentionOpen, setInternalMentionOpen] = React.useState(false);

    const mentionOpenResolved = (typeof mentionOpen === "boolean") ? mentionOpen : internalMentionOpen;
    const setMentionOpenResolved = (open: boolean) => {
        if (onMentionOpenChange) onMentionOpenChange(open);
        else setInternalMentionOpen(open);
    };

    const handleDetectMention = (nextValue: string) => {
        if (!mentionEnabled) return;
        const lastAt = nextValue.lastIndexOf('@');
        if (lastAt >= 0) {
            setMentionOpenResolved(true);
            const token = nextValue.slice(lastAt + 1).split(/\s/)[0] || '';
            if (onMentionQueryChange) onMentionQueryChange(token);
        } else {
            if (mentionOpenResolved) setMentionOpenResolved(false);
            if (onMentionQueryChange) onMentionQueryChange('');
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (disabled || loading) return;
        // Respect IME composition
        const anyEvt = e.nativeEvent as any;
        if (anyEvt && anyEvt.isComposing) return;

        const isMod = e.ctrlKey || e.metaKey;
        const isEnter = e.key === "Enter";

        if (!isEnter) return;

        if (sendKeyScheme === "enterToSend") {
            // Enter send; Mod+Enter newline
            if (isMod) return; // allow newline insertion by default behavior when mod is pressed
            e.preventDefault();
            if (value.trim().length > 0) onSend();
            return;
        }

        if (sendKeyScheme === "modEnterToSend") {
            // Mod+Enter send; Enter newline
            if (!(isMod)) return; // newline without mod
            e.preventDefault();
            if (value.trim().length > 0) onSend();
        }
    };

    const resolvedRadius = radius ?? (variant === "hero" ? "xl" : "lg");

    return (
        <div className={cn(
            "group w-full",
            className
        )}>
            <div
                className={cn(
                    "relative w-full border theme-background-secondary dark:bg-slate-950/60",
                    "focus-within:ring-2 focus-within:ring-blue-500",
                    "transition-shadow",
                    resolvedRadius === "xl" ? "rounded-3xl" : "rounded-2xl",
                )}
                aria-disabled={disabled || loading}
            >
                {/* Textarea */}
                <div className={cn(
                    "relative",
                    density === "compact" ? "px-3 pt-2 pb-2" : "px-4 pt-3 pb-3"
                )}>
                    {/* Inline adornments */}
                    {leftAdornment ? (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground ">
                            {leftAdornment}
                        </div>
                    ) : null}
                    {rightAdornment ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground">
                            {rightAdornment}
                        </div>
                    ) : null}
                    <TextareaAutosize
                        value={value}
                        onChange={(e) => {
                            const next = e.target.value;
                            onChange(next);
                            handleDetectMention(next);
                        }}
                        minRows={minRows}
                        maxRows={maxRows}
                        placeholder={placeholder}
                        disabled={disabled}
                        onKeyDown={onKeyDown}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        className={cn(
                            "w-full resize-none bg-transparent outline-none",
                            "text-base md:text-sm leading-6",
                            leftAdornment ? "pl-10" : undefined,
                            rightAdornment ? "pr-10" : undefined,
                            // reset any default rounded from shadcn Textarea
                            "rounded-none p-0",
                            textareaClassName
                        )}
                    />

                    {/* mention trigger moved to bottom toolbar near Send */}
                </div>

                {/* Bottom toolbar */}
                {(leftTools || rightTools || mentionEnabled) && (
                    <div className={cn(
                        "flex items-center justify-between text-muted-foreground",
                        density === "compact" ? "px-2 pb-2 pt-1" : "px-3 pb-2 pt-0"
                    )}>
                        <div className="flex items-center gap-2">{leftTools}</div>
                        <div className="flex items-center gap-2">
                            {mentionEnabled && (
                                <Popover open={mentionOpenResolved} onOpenChange={setMentionOpenResolved}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 rounded-full p-0"
                                            title={mentionTriggerTitle || "添加参考 (@)"}
                                            aria-label={mentionTriggerTitle || "添加参考 (@)"}
                                            onClick={() => setMentionOpenResolved(!mentionOpenResolved)}
                                        >
                                            <AtSign className="w-4 h-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-96 p-3">
                                        {renderMentionContent ? (
                                            renderMentionContent({
                                                value,
                                                setValue: (v: string) => {
                                                    onChange(v);
                                                    handleDetectMention(v);
                                                },
                                                close: () => setMentionOpenResolved(false),
                                                query: mentionQuery || '',
                                            })
                                        ) : (
                                            <div className="text-sm text-muted-foreground">未提供 mentions 内容渲染</div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            )}
                            {rightTools}
                        </div>
                    </div>
                )}
            </div>

            {/* Helper */}
            {helperText && (
                <div className="mt-2 text-xs text-muted-foreground">{helperText}</div>
            )}
        </div>
    );
};

MessageComposer.displayName = "MessageComposer";

export default MessageComposer;


