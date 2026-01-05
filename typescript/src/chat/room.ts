/**
 * Chat room orchestrator.
 */

import type { Provider, CompletionOptions } from '../providers/base.js';
import type { ChatConfig } from '../core/types.js';
import { DEFAULT_CHAT_CONFIG } from '../core/types.js';
import { ChatSession } from './session.js';
import { ChatDisplay } from './display.js';
import { CommandHandler } from './commands.js';
import { getSystemPrompt, makeExpandPrompt } from './prompts.js';

export class ChatRoom {
    public providers: Provider[];
    public config: ChatConfig;
    public session: ChatSession;
    private display: ChatDisplay;
    private commandHandler: CommandHandler;

    constructor(providers: Provider[], config?: Partial<ChatConfig>, session?: ChatSession) {
        this.providers = providers;
        this.config = { ...DEFAULT_CHAT_CONFIG, ...config };
        this.session = session || new ChatSession(providers.map(p => p.name));
        this.display = new ChatDisplay();
        this.commandHandler = new CommandHandler(this);
    }

    async start(): Promise<void> {
        this.display.showWelcome(this.providers.map(p => p.name));

        while (true) {
            try {
                const input = await this.display.getInput();
                const trimmed = input.trim();

                if (!trimmed) {
                    continue;
                }

                // Check for command
                const command = this.commandHandler.parse(trimmed);
                if (command) {
                    const result = await this.commandHandler.execute(command);
                    if (result.message) {
                        this.display.showCommandResult(result.message);
                    }
                    if (result.shouldExit) {
                        break;
                    }
                    continue;
                }

                // Parse @mentions
                const { content, targetModels } = this.parseMentions(trimmed);

                // Add user message to session
                this.session.addUserMessage(content);
                this.display.showUserMessage(content);

                // Send to models
                await this.sendMessage(content, targetModels);

            } catch (error) {
                if (error instanceof Error && error.message.includes('readline was closed')) {
                    break;
                }
                this.display.showError(error instanceof Error ? error.message : String(error));
            }
        }

        this.display.close();
    }

    async sendMessage(content: string, targetModelNames?: string[], expand: boolean = false): Promise<void> {
        // Determine which providers to use
        let targetProviders = this.providers;
        if (targetModelNames && targetModelNames.length > 0) {
            targetProviders = this.providers.filter(p =>
                targetModelNames.some(name =>
                    p.name.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(p.name.toLowerCase())
                )
            );
            if (targetProviders.length === 0) {
                this.display.showError(`No matching models found for: ${targetModelNames.join(', ')}`);
                return;
            }
        }

        // Show thinking indicator
        this.display.showThinking(targetProviders.map(p => p.name));

        // Build context
        const context = this.session.formatContext(this.config.maxHistoryMessages);

        // Generate responses in parallel
        const responses = await Promise.all(
            targetProviders.map(async (provider) => {
                try {
                    const otherModels = this.providers
                        .filter(p => p.name !== provider.name)
                        .map(p => p.name);

                    let systemPrompt = getSystemPrompt(provider.name, otherModels);
                    if (expand) {
                        systemPrompt = makeExpandPrompt(systemPrompt);
                    }

                    const prompt = context ? `${context}\n\nUser: ${content}` : content;

                    const options: CompletionOptions = {
                        systemPrompt,
                        maxTokens: expand ? this.config.expandMaxTokens : this.config.maxResponseTokens,
                    };

                    const response = await provider.generate(prompt, options);
                    return { provider: provider.name, response, error: null };
                } catch (error) {
                    return {
                        provider: provider.name,
                        response: null,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            })
        );

        this.display.clearThinking();

        // Display responses and add to session
        for (const result of responses) {
            if (result.error) {
                this.display.showError(`${result.provider}: ${result.error}`);
            } else if (result.response) {
                this.display.showModelResponse(result.provider, result.response);
                this.session.addAssistantMessage(result.response, result.provider, expand);
            }
        }
    }

    private parseMentions(input: string): { content: string; targetModels: string[] } {
        const mentionRegex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;

        while ((match = mentionRegex.exec(input)) !== null) {
            mentions.push(match[1]);
        }

        // Remove @mentions from content
        const content = input.replace(/@\w+\s*/g, '').trim();

        return {
            content: content || input, // Fall back to original if nothing left
            targetModels: mentions,
        };
    }
}
