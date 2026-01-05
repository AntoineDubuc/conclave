import { Provider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { ClaudeBinaryProvider } from './claude_binary.js';
import { JanusConfig } from '../core/types.js';
import chalk from 'chalk';

export class ProviderFactory {
    static createProviders(config: JanusConfig): Provider[] {
        const providers: Provider[] = [];

        // Iterate over active providers defined in the global config
        for (const providerName of config.active_providers) {
            const providerConfig = config.providers[providerName];
            if (!providerConfig) {
                console.warn(`Warning: Provider '${providerName}' configured as active but definition missing.`);
                continue;
            }

            try {
                switch (providerConfig.type) {
                    case 'openai':
                        providers.push(new OpenAIProvider(providerConfig));
                        break;
                    case 'anthropic':
                        // Check for valid API key (ignoring stubs)
                        const apiKey = providerConfig.api_key || process.env.ANTHROPIC_API_KEY;
                        const isPlaceholder = !apiKey || apiKey.trim() === '' || apiKey.includes('sk-ant-...');

                        if (apiKey && !isPlaceholder) {
                            providers.push(new AnthropicProvider(providerConfig));
                        } else {
                            // Fallback to CLI if key is missing or is just a placeholder
                            console.log(chalk.blue('ℹ Using `claude` (CLI) as no valid API Key specified.'));
                            providers.push(new ClaudeBinaryProvider(providerConfig));
                        }
                        break;
                    case 'gemini':
                        providers.push(new GeminiProvider(providerConfig));
                        break;
                    case 'openai_compatible':
                    case 'grok':
                        // Re-use OpenAI provider for generic endpoints (Grok, Ollama, etc)
                        // Allow Grok to instantiate if it has a key or URL
                        providers.push(new OpenAIProvider(providerConfig));
                        break;
                    default:
                        console.warn(`Unknown provider type: ${providerConfig.type}`);
                }
            } catch (error) {
                console.error(`Error initializing provider ${providerName}:`, error);
            }
        }

        return providers;
    }
}
