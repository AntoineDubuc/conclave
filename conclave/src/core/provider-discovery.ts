import chalk from 'chalk';
import { getClaudeCliStatus, ClaudeCliStatus } from './claude-cli.js';

export type AuthMethod = 'cli' | 'api_key' | 'none';

export interface DiscoveredProvider {
    name: string;
    displayName: string;
    available: boolean;
    authMethod: AuthMethod;
    details: string;
    requiresSetup: boolean;
    setupInstructions?: string;
}

export interface ProviderDiscoveryResult {
    anthropic: DiscoveredProvider & { cliStatus?: ClaudeCliStatus };
    openai: DiscoveredProvider;
    gemini: DiscoveredProvider;
}

/**
 * Check if an API key is valid (not empty, not a placeholder)
 */
function isValidApiKey(key: string | undefined): boolean {
    if (!key) return false;
    const trimmed = key.trim();
    if (trimmed === '') return false;
    if (trimmed.includes('...')) return false; // Placeholder like "sk-ant-..."
    if (trimmed === 'your-api-key-here') return false;
    return true;
}

/**
 * Discover Anthropic/Claude provider availability
 */
async function discoverAnthropic(): Promise<DiscoveredProvider & { cliStatus?: ClaudeCliStatus }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasApiKey = isValidApiKey(apiKey);

    // Check CLI status
    const cliStatus = await getClaudeCliStatus();

    // Priority 1: API key is set and valid
    if (hasApiKey) {
        return {
            name: 'anthropic',
            displayName: 'Anthropic (Claude)',
            available: true,
            authMethod: 'api_key',
            details: 'Using API key (pay-per-token)',
            requiresSetup: false,
            cliStatus
        };
    }

    // Priority 2: CLI is installed and authenticated
    if (cliStatus.installed && cliStatus.authenticated) {
        return {
            name: 'anthropic',
            displayName: 'Anthropic (Claude)',
            available: true,
            authMethod: 'cli',
            details: `Using Claude CLI v${cliStatus.version} (subscription)`,
            requiresSetup: false,
            cliStatus
        };
    }

    // Priority 3: CLI installed but not authenticated
    if (cliStatus.installed && !cliStatus.authenticated) {
        return {
            name: 'anthropic',
            displayName: 'Anthropic (Claude)',
            available: false,
            authMethod: 'none',
            details: `Claude CLI v${cliStatus.version} found but not logged in`,
            requiresSetup: true,
            setupInstructions: 'Run "claude" to log in with your account',
            cliStatus
        };
    }

    // Priority 4: Nothing available
    return {
        name: 'anthropic',
        displayName: 'Anthropic (Claude)',
        available: false,
        authMethod: 'none',
        details: 'No API key or Claude CLI found',
        requiresSetup: true,
        setupInstructions: 'Install Claude CLI: npm install -g @anthropic-ai/claude-code\nOr set ANTHROPIC_API_KEY in .env',
        cliStatus
    };
}

/**
 * Discover OpenAI provider availability
 */
function discoverOpenAI(): DiscoveredProvider {
    const apiKey = process.env.OPENAI_API_KEY;
    const hasApiKey = isValidApiKey(apiKey);

    if (hasApiKey) {
        return {
            name: 'openai',
            displayName: 'OpenAI (GPT)',
            available: true,
            authMethod: 'api_key',
            details: 'API key configured',
            requiresSetup: false
        };
    }

    return {
        name: 'openai',
        displayName: 'OpenAI (GPT)',
        available: false,
        authMethod: 'none',
        details: 'OPENAI_API_KEY not set',
        requiresSetup: true,
        setupInstructions: 'Get your API key from https://platform.openai.com/api-keys'
    };
}

/**
 * Discover Google Gemini provider availability
 */
function discoverGemini(): DiscoveredProvider {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const hasApiKey = isValidApiKey(apiKey);

    if (hasApiKey) {
        return {
            name: 'gemini',
            displayName: 'Google Gemini',
            available: true,
            authMethod: 'api_key',
            details: 'API key configured',
            requiresSetup: false
        };
    }

    return {
        name: 'gemini',
        displayName: 'Google Gemini',
        available: false,
        authMethod: 'none',
        details: 'GEMINI_API_KEY not set',
        requiresSetup: true,
        setupInstructions: 'Get your API key from https://aistudio.google.com/apikey (free tier available!)'
    };
}

/**
 * Discover all providers and their availability
 */
export async function discoverProviders(): Promise<ProviderDiscoveryResult> {
    // Run discoveries in parallel where possible
    const [anthropic, openai, gemini] = await Promise.all([
        discoverAnthropic(),
        Promise.resolve(discoverOpenAI()),
        Promise.resolve(discoverGemini())
    ]);

    return { anthropic, openai, gemini };
}

/**
 * Display discovery results in a formatted way
 */
export function displayDiscoveryResults(results: ProviderDiscoveryResult): void {
    const providers = [results.anthropic, results.openai, results.gemini];

    for (const provider of providers) {
        console.log(chalk.bold(`\n${provider.displayName}`));

        if (provider.available) {
            console.log(chalk.green(`  ✓ ${provider.details}`));
            if (provider.authMethod === 'cli') {
                console.log(chalk.cyan('    → Using your subscription (no API charges)'));
            }
        } else {
            console.log(chalk.red(`  ✗ ${provider.details}`));
            if (provider.setupInstructions) {
                const lines = provider.setupInstructions.split('\n');
                lines.forEach(line => {
                    console.log(chalk.gray(`    ${line}`));
                });
            }
        }
    }
}

/**
 * Get list of available provider names
 */
export function getAvailableProviderNames(results: ProviderDiscoveryResult): string[] {
    const available: string[] = [];

    if (results.anthropic.available) available.push('anthropic');
    if (results.openai.available) available.push('openai');
    if (results.gemini.available) available.push('gemini');

    return available;
}

/**
 * Check if minimum providers are available for a debate (at least 2)
 */
export function hasMinimumProviders(results: ProviderDiscoveryResult): boolean {
    return getAvailableProviderNames(results).length >= 2;
}
