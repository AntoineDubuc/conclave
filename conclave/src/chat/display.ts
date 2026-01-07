/**
 * Terminal display for chat.
 */

import chalk from 'chalk';
import readline from 'readline';
import { printBanner } from '../utils/banner.js';

// Model color mapping
const MODEL_COLORS: Record<string, chalk.Chalk> = {
    anthropic: chalk.magenta,
    openai: chalk.green,
    gemini: chalk.blue,
    grok: chalk.red,
};

function getModelColor(modelName: string): chalk.Chalk {
    const lowerName = modelName.toLowerCase();
    for (const [key, color] of Object.entries(MODEL_COLORS)) {
        if (lowerName.includes(key)) {
            return color;
        }
    }
    return chalk.white;
}

export class ChatDisplay {
    private rl: readline.Interface | null = null;

    showWelcome(models: string[]): void {
        console.log();
        printBanner('Chat Room');
        console.log();
        console.log(chalk.gray(`Models: ${models.join(', ')}`));
        console.log(chalk.gray('Type /help for commands, /quit to exit'));
        console.log();
    }

    showUserMessage(content: string): void {
        const boxWidth = Math.min(process.stdout.columns || 80, 78);
        const border = '─'.repeat(boxWidth - 2);

        console.log(chalk.cyan(`╭${border}╮`));
        console.log(chalk.cyan(`│ ${chalk.bold('You')}`));
        console.log(chalk.cyan(`├${border}┤`));

        // Word wrap content
        const lines = this.wrapText(content, boxWidth - 4);
        for (const line of lines) {
            console.log(chalk.cyan(`│ `) + line);
        }

        console.log(chalk.cyan(`╰${border}╯`));
    }

    showModelResponse(model: string, content: string): void {
        const color = getModelColor(model);
        const boxWidth = Math.min(process.stdout.columns || 80, 78);
        const border = '─'.repeat(boxWidth - 2);

        console.log(color(`╭${border}╮`));
        console.log(color(`│ ${chalk.bold(model)}`));
        console.log(color(`├${border}┤`));

        // Word wrap content
        const lines = this.wrapText(content, boxWidth - 4);
        for (const line of lines) {
            console.log(color(`│ `) + line);
        }

        console.log(color(`╰${border}╯`));
    }

    showThinking(models: string[]): void {
        const names = models.join(', ');
        process.stdout.write(chalk.gray(`  ${names} thinking...`));
    }

    clearThinking(): void {
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
    }

    showCommandResult(message: string): void {
        console.log(chalk.yellow(message));
    }

    showError(error: string): void {
        console.log(chalk.red.bold('Error: ') + error);
    }

    async getInput(): Promise<string> {
        return new Promise((resolve) => {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            this.rl.question(chalk.cyan.bold('You: '), (answer) => {
                this.rl?.close();
                this.rl = null;
                resolve(answer);
            });
        });
    }

    close(): void {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }

    private wrapText(text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            // Handle newlines in text
            if (word.includes('\n')) {
                const parts = word.split('\n');
                for (let i = 0; i < parts.length; i++) {
                    if (i > 0) {
                        lines.push(currentLine);
                        currentLine = '';
                    }
                    if (parts[i]) {
                        if (currentLine.length + parts[i].length + 1 <= maxWidth) {
                            currentLine += (currentLine ? ' ' : '') + parts[i];
                        } else {
                            if (currentLine) lines.push(currentLine);
                            currentLine = parts[i];
                        }
                    }
                }
                continue;
            }

            if (currentLine.length + word.length + 1 <= maxWidth) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [''];
    }
}
