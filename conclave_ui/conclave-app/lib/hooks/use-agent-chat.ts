"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ChatMessage,
  ApiKeys,
  SSEEvent,
  ToolCallDisplay,
} from "@/lib/types/agent-chat";
import { createClient } from "@/lib/supabase/client";

const AGENT_SERVICE_URL = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || "http://localhost:8554";

/**
 * Save a flow created by the agent to the database via API
 */
async function saveFlowToDatabase(flowData: {
  name: string;
  slug: string;
  description?: string;
  config: unknown;
}): Promise<CreatedFlowInfo | null> {
  try {
    const response = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: flowData.name,
        slug: flowData.slug,
        description: flowData.description,
        config: flowData.config,
        is_public: false, // Private by default
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Failed to save flow:", errorData);
      return null;
    }

    const result = await response.json();
    return {
      id: result.flow.id,
      name: result.flow.name,
      slug: result.flow.slug,
      description: result.flow.description,
    };
  } catch (error) {
    console.error("Error saving flow to database:", error);
    return null;
  }
}

export interface CreatedFlowInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface UseAgentChatOptions {
  apiKeys?: ApiKeys;
  onToolUse?: (tool: string, input: unknown) => void;
  onToolResult?: (tool: string, result: unknown) => void;
  onFlowCreated?: (flow: CreatedFlowInfo) => void;
  onError?: (error: string) => void;
}

export interface UseAgentChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  isConnecting: boolean;
  error: string | null;
  sessionId: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  startNewSession: () => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const { apiKeys, onToolUse, onToolResult, onFlowCreated, onError } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantMessageRef = useRef<string>("");
  const currentToolCallsRef = useRef<ToolCallDisplay[]>([]);
  const isSendingRef = useRef(false); // Guard against duplicate sends

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("agent_chat_session");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Check if session is expired (30 min)
        if (Date.now() - data.lastActivity < 30 * 60 * 1000) {
          setSessionId(data.sessionId);
          setMessages(data.messages.map((m: ChatMessage) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })));
        } else {
          localStorage.removeItem("agent_chat_session");
        }
      } catch {
        localStorage.removeItem("agent_chat_session");
      }
    }
  }, []);

  // Save session to localStorage when messages change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem("agent_chat_session", JSON.stringify({
        sessionId,
        messages,
        lastActivity: Date.now(),
      }));
    }
  }, [sessionId, messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    currentAssistantMessageRef.current = "";
    currentToolCallsRef.current = [];
  }, []);

  const startNewSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSessionId(null);
    clearMessages();
    localStorage.removeItem("agent_chat_session");
  }, [clearMessages]);

  const handleSSEEvent = useCallback((event: SSEEvent, assistantMessageId: string) => {
    switch (event.type) {
      case "connected":
        setSessionId(event.session_id);
        break;

      case "text":
        currentAssistantMessageRef.current += event.delta;
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: currentAssistantMessageRef.current }
            : m
        ));
        break;

      case "tool_use": {
        const toolCall: ToolCallDisplay = {
          id: event.tool_use_id || generateId(),
          tool: event.tool,
          status: "running",
          input: event.input,
        };
        currentToolCallsRef.current.push(toolCall);
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, toolCalls: [...currentToolCallsRef.current] }
            : m
        ));
        onToolUse?.(event.tool, event.input);
        break;
      }

      case "tool_result": {
        const toolIndex = currentToolCallsRef.current.findIndex(
          tc => tc.tool === event.tool && tc.status === "running"
        );
        if (toolIndex !== -1) {
          currentToolCallsRef.current[toolIndex] = {
            ...currentToolCallsRef.current[toolIndex],
            status: "complete",
            result: event.result,
          };
          setMessages(prev => prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, toolCalls: [...currentToolCallsRef.current] }
              : m
          ));
        }
        onToolResult?.(event.tool, event.result);

        // Detect flow creation from task tool results and save to database
        if (event.tool === "task" && typeof event.result === "object" && event.result !== null) {
          const result = event.result as Record<string, unknown>;
          // Check if the result contains flow creation success
          if (result.flow_created && typeof result.flow === "object" && result.flow !== null) {
            const flowData = result.flow as Record<string, unknown>;
            const flowName = flowData.name as string;
            const flowSlug = flowData.slug as string;
            const flowDescription = typeof flowData.description === "string" ? flowData.description : undefined;
            const flowConfig = flowData.config;

            if (flowName && flowSlug && flowConfig) {
              // Save to database via API
              saveFlowToDatabase({
                name: flowName,
                slug: flowSlug,
                description: flowDescription,
                config: flowConfig,
              }).then((savedFlow: CreatedFlowInfo | null) => {
                if (savedFlow && onFlowCreated) {
                  onFlowCreated(savedFlow);
                }
              }).catch((saveError: Error) => {
                console.error("Failed to save flow to database:", saveError);
                // Still notify with local data (no id)
                onFlowCreated?.({
                  id: `local-${Date.now()}`,
                  name: flowName,
                  slug: flowSlug,
                  description: flowDescription,
                });
              });
            }
          }
        }
        break;
      }

      case "flow_created":
        // Direct flow creation event from agent service
        onFlowCreated?.(event.flow);
        break;

      case "error":
        setError(event.message);
        onError?.(event.message);
        break;

      case "done":
        // Session confirmed
        setSessionId(event.session_id);
        break;
    }
  }, [onToolUse, onToolResult, onFlowCreated, onError]);

  const sendMessage = useCallback(async (message: string) => {
    // Guard against duplicate sends using ref (synchronous check)
    if (!message.trim() || isStreaming || isSendingRef.current) return;
    isSendingRef.current = true;

    setError(null);
    setIsConnecting(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Prepare assistant message placeholder
    const assistantMessageId = generateId();
    currentAssistantMessageRef.current = "";
    currentToolCallsRef.current = [];

    // Add empty assistant message that will be updated
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    }]);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Get auth token from Supabase
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated. Please sign in to continue.");
      }

      const requestBody = JSON.stringify({
        message: message.trim(),
        // Only include session_id if it's not null (schema expects string | undefined, not null)
        ...(sessionId && { session_id: sessionId }),
        // Only include api_keys if provided
        ...(apiKeys && { api_keys: apiKeys }),
      });

      const makeRequest = async (token: string) => {
        return fetch(`${AGENT_SERVICE_URL}/api/chat/message/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: requestBody,
          signal: abortControllerRef.current!.signal,
        });
      };

      let response = await makeRequest(accessToken);

      // On 401, try refreshing the token once and retry
      if (response.status === 401) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        const newToken = refreshData?.session?.access_token;
        if (newToken) {
          response = await makeRequest(newToken);
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      setIsConnecting(false);
      setIsStreaming(true);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const event: SSEEvent = JSON.parse(jsonStr);
              handleSSEEvent(event, assistantMessageId);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Finalize the assistant message
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? {
              ...m,
              content: currentAssistantMessageRef.current,
              toolCalls: [...currentToolCallsRef.current],
              isStreaming: false,
            }
          : m
      ));

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Connection failed";
      setError(errorMessage);
      onError?.(errorMessage);

      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsConnecting(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
      isSendingRef.current = false; // Release guard
    }
  }, [sessionId, apiKeys, isStreaming, onError, handleSSEEvent]);

  return {
    messages,
    isStreaming,
    isConnecting,
    error,
    sessionId,
    sendMessage,
    clearMessages,
    startNewSession,
  };
}
