"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TemplateButtons, type Template } from "./template-buttons"

interface TaskInputProps {
  value: string
  onChange: (value: string) => void
  onRunFlow?: () => void
  isRunning?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
}

// Rough estimate: ~4 characters per token (OpenAI/Claude average)
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

function TaskInput({
  value,
  onChange,
  onRunFlow,
  isRunning = false,
  disabled = false,
  placeholder = "Describe your task in detail. Be specific about what you want the AI models to accomplish...",
  maxLength = 10000,
  className,
}: TaskInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const characterCount = value.length
  const tokenEstimate = estimateTokens(value)

  const handleTemplateSelect = (template: Template) => {
    const newValue = template.prompt + " "
    onChange(newValue)
    // Focus textarea and place cursor at end
    if (textareaRef.current) {
      textareaRef.current.focus()
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newValue.length
          textareaRef.current.selectionEnd = newValue.length
        }
      }, 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to run flow
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && onRunFlow && !disabled && !isRunning) {
      e.preventDefault()
      onRunFlow()
    }
  }

  return (
    <div className={cn("glass-card p-6", className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Task Description</h3>
          <span className="text-xs text-muted-foreground">
            Press {typeof window !== "undefined" && navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to run
          </span>
        </div>

        {/* Template Buttons */}
        <TemplateButtons onSelect={handleTemplateSelect} disabled={isRunning} />

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isRunning}
            maxLength={maxLength}
            rows={6}
            className={cn(
              "w-full min-h-[160px] resize-y rounded-lg px-4 py-3",
              "bg-white/5 border border-white/10",
              "text-white placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
        </div>

        {/* Footer with counts and run button */}
        <div className="flex items-center justify-between">
          {/* Character and token counts */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              {characterCount.toLocaleString()} / {maxLength.toLocaleString()} characters
            </span>
            <span className="text-white/20">|</span>
            <span>~{tokenEstimate.toLocaleString()} tokens (estimate)</span>
          </div>

          {/* Run Flow Button */}
          {onRunFlow && (
            <button
              onClick={onRunFlow}
              disabled={disabled || isRunning || !value.trim()}
              className={cn(
                "btn-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              )}
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Running...
                </span>
              ) : (
                "Run Flow"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { TaskInput }
export type { TaskInputProps }
