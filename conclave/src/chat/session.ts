/**
 * Chat session state management.
 */

import { ChatMessage, MessageRole } from '../core/types.js';

function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

export class ChatSession {
    public sessionId: string;
    public createdAt: Date;
    public activeModels: string[];
    public messages: ChatMessage[];

    constructor(activeModels: string[], sessionId?: string) {
        this.sessionId = sessionId || generateId();
        this.createdAt = new Date();
        this.activeModels = activeModels;
        this.messages = [];
    }

    addUserMessage(content: string): ChatMessage {
        const message: ChatMessage = {
            id: generateId(),
            role: MessageRole.USER,
            content,
            timestamp: new Date(),
            isExpanded: false,
        };
        this.messages.push(message);
        return message;
    }

    addAssistantMessage(content: string, model: string, isExpanded: boolean = false): ChatMessage {
        const message: ChatMessage = {
            id: generateId(),
            role: MessageRole.ASSISTANT,
            content,
            model,
            timestamp: new Date(),
            isExpanded,
        };
        this.messages.push(message);
        return message;
    }

    formatContext(maxMessages: number = 50): string {
        const recentMessages = this.messages.slice(-maxMessages);

        return recentMessages.map(msg => {
            if (msg.role === MessageRole.USER) {
                return `User: ${msg.content}`;
            } else {
                return `${msg.model}: ${msg.content}`;
            }
        }).join('\n\n');
    }

    getLastUserMessage(): ChatMessage | undefined {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i].role === MessageRole.USER) {
                return this.messages[i];
            }
        }
        return undefined;
    }

    clear(): void {
        this.messages = [];
    }

    toJSON(): object {
        return {
            sessionId: this.sessionId,
            createdAt: this.createdAt.toISOString(),
            activeModels: this.activeModels,
            messages: this.messages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp.toISOString(),
            })),
        };
    }

    static fromJSON(data: any): ChatSession {
        const session = new ChatSession(data.activeModels, data.sessionId);
        session.createdAt = new Date(data.createdAt);
        session.messages = data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
        }));
        return session;
    }
}
