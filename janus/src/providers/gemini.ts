import { GoogleGenerativeAI } from '@google/generative-ai';
import { Provider, CompletionOptions } from './base.js';
import { ProviderConfig } from '../core/types.js';

export class GeminiProvider implements Provider {
    public name = 'Gemini';
    private genAI: GoogleGenerativeAI;
    private modelName: string;

    constructor(config: ProviderConfig) {
        this.modelName = config.model || 'gemini-3-pro-preview';
        const apiKey = config.api_key || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is missing');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async generate(prompt: string, options?: CompletionOptions): Promise<string> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: this.modelName,
                generationConfig: {
                    maxOutputTokens: options?.maxTokens,
                    temperature: options?.temperature,
                },
                systemInstruction: options?.systemPrompt
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`Gemini Error:`, error);
            return `[Error] Gemini failed to generate response: ${error}`;
        }
    }
}
