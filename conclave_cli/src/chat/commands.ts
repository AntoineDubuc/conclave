/**
 * Chat command parser and handler.
 */

import { saveSession, loadSession, listSessions } from './persistence.js';
import type { ChatRoom } from './room.js';

export interface CommandResult {
    shouldExit: boolean;
    message?: string;
}

export interface ParsedCommand {
    name: string;
    args: string[];
}

export class CommandHandler {
    private room: ChatRoom;

    constructor(room: ChatRoom) {
        this.room = room;
    }

    parse(input: string): ParsedCommand | null {
        if (!input.startsWith('/')) {
            return null;
        }

        const parts = input.slice(1).split(/\s+/);
        const name = parts[0].toLowerCase();
        const args = parts.slice(1);

        return { name, args };
    }

    async execute(command: ParsedCommand): Promise<CommandResult> {
        switch (command.name) {
            case 'help':
            case 'h':
                return this.showHelp();

            case 'quit':
            case 'exit':
            case 'q':
                return { shouldExit: true, message: 'Goodbye!' };

            case 'clear':
                return this.clearHistory();

            case 'models':
                return this.showModels();

            case 'expand':
                return this.expandLast();

            case 'save':
                return this.saveSession(command.args[0]);

            case 'load':
                return this.loadSession(command.args[0]);

            case 'sessions':
                return this.listSessions();

            case 'ask':
                return this.askModel(command.args);

            default:
                return { shouldExit: false, message: `Unknown command: /${command.name}. Type /help for commands.` };
        }
    }

    private showHelp(): CommandResult {
        const help = `
Commands:
  /help              Show this help
  /quit or /exit     Exit chat
  /clear             Clear conversation history
  /models            Show active models
  /expand            Get detailed response to last message
  /save [file]       Save session to file
  /load <file>       Load previous session
  /sessions          List saved sessions
  /ask <model>       Get response from one model only

Tips:
  - @anthropic, @openai etc. addresses specific models
  - Responses are kept brief (2-4 sentences) by default
  - Use /expand for detailed explanations
`;
        return { shouldExit: false, message: help };
    }

    private clearHistory(): CommandResult {
        this.room.session.clear();
        return { shouldExit: false, message: 'Conversation history cleared.' };
    }

    private showModels(): CommandResult {
        const models = this.room.providers.map(p => p.name).join(', ');
        return { shouldExit: false, message: `Active models: ${models}` };
    }

    private async expandLast(): Promise<CommandResult> {
        const lastMessage = this.room.session.getLastUserMessage();
        if (!lastMessage) {
            return { shouldExit: false, message: 'No previous message to expand.' };
        }

        // Trigger expanded response
        await this.room.sendMessage(lastMessage.content, undefined, true);
        return { shouldExit: false };
    }

    private saveSession(filename?: string): CommandResult {
        try {
            const path = saveSession(this.room.session, filename);
            return { shouldExit: false, message: `Session saved to: ${path}` };
        } catch (error) {
            return { shouldExit: false, message: `Failed to save: ${error}` };
        }
    }

    private loadSession(filename?: string): CommandResult {
        if (!filename) {
            return { shouldExit: false, message: 'Usage: /load <filename>' };
        }

        try {
            const session = loadSession(filename);
            this.room.session = session;
            return { shouldExit: false, message: `Loaded session: ${session.sessionId} (${session.messages.length} messages)` };
        } catch (error) {
            return { shouldExit: false, message: `Failed to load: ${error}` };
        }
    }

    private listSessions(): CommandResult {
        try {
            const sessions = listSessions();
            if (sessions.length === 0) {
                return { shouldExit: false, message: 'No saved sessions.' };
            }
            return { shouldExit: false, message: `Saved sessions:\n  ${sessions.join('\n  ')}` };
        } catch (error) {
            return { shouldExit: false, message: `Failed to list sessions: ${error}` };
        }
    }

    private async askModel(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return { shouldExit: false, message: 'Usage: /ask <model> [message]' };
        }

        const modelName = args[0].toLowerCase();
        const message = args.slice(1).join(' ');

        // Find matching provider
        const provider = this.room.providers.find(
            p => p.name.toLowerCase().includes(modelName) || modelName.includes(p.name.toLowerCase())
        );

        if (!provider) {
            return { shouldExit: false, message: `Model not found: ${modelName}` };
        }

        if (message) {
            await this.room.sendMessage(message, [provider.name]);
        }

        return { shouldExit: false, message: message ? undefined : `Next message will go to ${provider.name} only. Just type your message.` };
    }
}
