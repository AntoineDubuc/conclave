import { Provider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { ClaudeBinaryProvider } from './claude_binary.js';
import { ConclaveConfig, ProviderConfig } from '../core/types.js';
import chalk from 'chalk';

/**
 * Determine the best auth method for Anthropic provider
 */
function resolveAnthropicAuthMethod(providerConfig: ProviderConfig): 'cli' | 'api_key' {
    const configuredMethod = providerConfig.auth_method || 'auto';

    // If explicitly set to cli or api_key, respect that
    if (configuredMethod === 'cli') {
        return 'cli';
    }

    if (configuredMethod === 'api_key') {
        return 'api_key';
    }

    // Auto mode: check for valid API key first
    const apiKey = providerConfig.api_key || process.env.ANTHROPIC_API_KEY;
    const isValidKey = apiKey &&
                       apiKey.trim() !== '' &&
                       !apiKey.includes('sk-ant-...') &&
                       !apiKey.includes('your-api-key');

    if (isValidKey) {
        return 'api_key';
    }

    // Default to CLI (subscription-based)
    return 'cli';
}

export class ProviderFactory {
    static createProviders(config: ConclaveConfig): Provider[] {
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

                    case 'anthropic': {
                        const authMethod = resolveAnthropicAuthMethod(providerConfig);

                        if (authMethod === 'api_key') {
                            providers.push(new AnthropicProvider(providerConfig));
                        } else {
                            console.log(chalk.blue('ℹ Using Claude CLI (subscription mode)'));
                            providers.push(new ClaudeBinaryProvider(providerConfig));
                        }
                        break;
                    }

                    case 'gemini':
                        providers.push(new GeminiProvider(providerConfig));
                        break;

                    case 'openai_compatible':
                    case 'grok':
                        // Re-use OpenAI provider for generic endpoints (Grok, Ollama, etc)
                        providers.push(new OpenAIProvider(providerConfig));
                        break;

                    default:
                        console.warn(`Unknown provider type: ${(providerConfig as any).type}`);
                }
            } catch (error) {
                console.error(`Error initializing provider ${providerName}:`, error);
            }
        }

        return providers;
    }
}
