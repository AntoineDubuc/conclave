import OpenAI from 'openai';
import { Provider, CompletionOptions } from './base.js';
import { ProviderConfig } from '../core/types.js';

export class OpenAIProvider implements Provider {
    public name = 'OpenAI';
    private client: OpenAI;
    private model: string;

    constructor(config: ProviderConfig) {
        this.model = config.model || 'gpt-4o';
        this.client = new OpenAI({
            apiKey: config.api_key || process.env.OPENAI_API_KEY,
        });
    }

    async generate(prompt: string, options?: CompletionOptions): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: options?.systemPrompt || 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                model: this.model,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
            });

            return completion.choices[0].message.content || '';
        } catch (error) {
            console.error(`OpenAI Error:`, error);
            return `[Error] OpenAI failed to generate response: ${error}`;
        }
    }
}
