import Anthropic from '@anthropic-ai/sdk';
import { Provider, CompletionOptions } from './base.js';
import { ProviderConfig } from '../core/types.js';

export class AnthropicProvider implements Provider {
    public name = 'Anthropic';
    private client: Anthropic;
    private model: string;

    constructor(config: ProviderConfig) {
        this.model = config.model || 'claude-3-5-sonnet-20240620';
        this.client = new Anthropic({
            apiKey: config.api_key || process.env.ANTHROPIC_API_KEY,
        });
    }

    async generate(prompt: string, options?: CompletionOptions): Promise<string> {
        try {
            const msg = await this.client.messages.create({
                model: this.model,
                max_tokens: options?.maxTokens || 4096,
                temperature: options?.temperature ?? 0.7,
                system: options?.systemPrompt || 'You are a helpful assistant.',
                messages: [{ role: 'user', content: prompt }],
            });

            // Anthropic content can be blocks, we extract text
            const textBlock = msg.content.find(c => c.type === 'text');
            return textBlock?.text || '';
        } catch (error) {
            console.error(`Anthropic Error:`, error);
            return `[Error] Anthropic failed to generate response: ${error}`;
        }
    }
}
