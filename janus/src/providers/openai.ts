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
            // GPT-5.x models use max_completion_tokens, older models use max_tokens
            const isGpt5 = this.model.startsWith('gpt-5') || this.model.startsWith('o1') || this.model.startsWith('o3');

            const requestParams: any = {
                messages: [
                    { role: 'system', content: options?.systemPrompt || 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                model: this.model,
            };

            // GPT-5.x and reasoning models don't support temperature
            if (!isGpt5) {
                requestParams.temperature = options?.temperature ?? 0.7;
            }

            // Use appropriate token parameter based on model
            if (options?.maxTokens) {
                if (isGpt5) {
                    requestParams.max_completion_tokens = options.maxTokens;
                } else {
                    requestParams.max_tokens = options.maxTokens;
                }
            }

            const completion = await this.client.chat.completions.create(requestParams);

            return completion.choices[0].message.content || '';
        } catch (error) {
            console.error(`OpenAI Error:`, error);
            return `[Error] OpenAI failed to generate response: ${error}`;
        }
    }
}
