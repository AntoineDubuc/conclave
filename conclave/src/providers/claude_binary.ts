import { spawn } from 'child_process';
import { Provider, CompletionOptions } from './base.js';
import { ProviderConfig } from '../core/types.js';

export class ClaudeBinaryProvider implements Provider {
    public name = 'Anthropic (CLI)';
    private model: string;

    constructor(config: ProviderConfig) {
        this.model = config.model || '';
    }

    async generate(prompt: string, options?: CompletionOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            const args = ['-p', prompt, '--dangerously-skip-permissions'];

            if (this.model) {
                args.push('--model', this.model);
            }

            if (options?.systemPrompt) {
                args.push('--system-prompt', options.systemPrompt);
            }

            const child = spawn('claude', args, {
                shell: false, // Don't use shell to avoid prompt being interpreted as commands
                stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin so we don't hang if it asks for input
            });

            let stdoutData = '';
            let stderrData = '';

            // Stream stdout (optional: usually we just want to capture it, 
            // but if we want to show it live, we can process.stdout.write. 
            // For now, let's capture it but let stderr show status).
            child.stdout.on('data', (chunk) => {
                stdoutData += chunk.toString();
            });

            // Stream stderr to parent process so user sees "Thinking..." or auth errors immediately
            child.stderr.on('data', (chunk) => {
                const text = chunk.toString();
                stderrData += text;
                process.stderr.write(text); // Pass through to user terminal
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    // If it failed, we return the error from stderr
                    // But if we have *some* output, maybe we return that? 
                    // Usually code != 0 means hard failure.
                    console.error(`Claude CLI exited with code ${code}`);
                    // We return the error string so Conclave pipeline sees it as a failure response
                    resolve(`[Error] Claude CLI failed (Exit ${code}): ${stderrData}`);
                } else {
                    resolve(stdoutData.trim());
                }
            });

            child.on('error', (err) => {
                console.error('Failed to start Claude CLI:', err);
                resolve(`[Error] Failed to start Claude CLI: ${err.message}`);
            });
        });
    }
}
