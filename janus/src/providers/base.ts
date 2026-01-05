export interface CompletionOptions {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface Provider {
    name: string;
    generate(prompt: string, options?: CompletionOptions): Promise<string>;
}
