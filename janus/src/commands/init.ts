import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../core/config.js';
import { discoverProviders, displayDiscoveryResults, getAvailableProviderNames, ProviderDiscoveryResult } from '../core/provider-discovery.js';
import { promptClaudeLogin, displayClaudeStatus } from '../core/claude-cli.js';
import { JanusConfig } from '../core/types.js';

const BANNER = `
     ██╗ █████╗ ███╗   ██╗██╗   ██╗███████╗
     ██║██╔══██╗████╗  ██║██║   ██║██╔════╝
     ██║███████║██╔██╗ ██║██║   ██║███████╗
██   ██║██╔══██║██║╚██╗██║██║   ██║╚════██║
╚█████╔╝██║  ██║██║ ╚████║╚██████╔╝███████║
 ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝
`;

/**
 * Handle setup for a provider that needs configuration
 */
async function setupProvider(
    providerName: string,
    discovery: ProviderDiscoveryResult
): Promise<{ configured: boolean; authMethod: 'cli' | 'api_key' | 'none' }> {

    if (providerName === 'anthropic') {
        const anthropic = discovery.anthropic;

        // Already configured
        if (anthropic.available) {
            return { configured: true, authMethod: anthropic.authMethod };
        }

        // CLI installed but not logged in
        if (anthropic.cliStatus?.installed && !anthropic.cliStatus?.authenticated) {
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Claude CLI is installed but not logged in. How would you like to authenticate?',
                choices: [
                    { name: 'Log in to Claude (use Pro/Max subscription)', value: 'login' },
                    { name: 'Enter API key (pay-per-token)', value: 'apikey' },
                    { name: 'Skip Anthropic for now', value: 'skip' }
                ]
            }]);

            if (action === 'login') {
                const success = await promptClaudeLogin();
                if (success) {
                    console.log(chalk.green('\n✓ Successfully logged in to Claude!'));
                    return { configured: true, authMethod: 'cli' };
                } else {
                    console.log(chalk.yellow('\nLogin was not completed. You can try again later with: janus auth-claude'));
                    return { configured: false, authMethod: 'none' };
                }
            } else if (action === 'apikey') {
                const { apiKey } = await inquirer.prompt([{
                    type: 'password',
                    name: 'apiKey',
                    message: 'Enter your Anthropic API key:',
                    mask: '*'
                }]);

                if (apiKey && apiKey.trim()) {
                    console.log(chalk.cyan('\nAdd this to your .env file:'));
                    console.log(chalk.white(`ANTHROPIC_API_KEY=${apiKey}\n`));
                    return { configured: true, authMethod: 'api_key' };
                }
                return { configured: false, authMethod: 'none' };
            }

            return { configured: false, authMethod: 'none' };
        }

        // CLI not installed
        if (!anthropic.cliStatus?.installed) {
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Claude CLI is not installed. How would you like to use Claude?',
                choices: [
                    { name: 'Show install instructions (recommended for Max subscribers)', value: 'install' },
                    { name: 'Enter API key (pay-per-token)', value: 'apikey' },
                    { name: 'Skip Anthropic for now', value: 'skip' }
                ]
            }]);

            if (action === 'install') {
                console.log(chalk.cyan('\nTo install Claude Code CLI:'));
                console.log(chalk.white('  npm install -g @anthropic-ai/claude-code'));
                console.log(chalk.gray('\nAfter installing, run: claude'));
                console.log(chalk.gray('Then re-run: janus init\n'));
                return { configured: false, authMethod: 'none' };
            } else if (action === 'apikey') {
                const { apiKey } = await inquirer.prompt([{
                    type: 'password',
                    name: 'apiKey',
                    message: 'Enter your Anthropic API key:',
                    mask: '*'
                }]);

                if (apiKey && apiKey.trim()) {
                    console.log(chalk.cyan('\nAdd this to your .env file:'));
                    console.log(chalk.white(`ANTHROPIC_API_KEY=${apiKey}\n`));
                    return { configured: true, authMethod: 'api_key' };
                }
                return { configured: false, authMethod: 'none' };
            }

            return { configured: false, authMethod: 'none' };
        }
    }

    // OpenAI or Gemini - just need API key
    if (providerName === 'openai' || providerName === 'gemini') {
        const provider = discovery[providerName];
        const envVar = providerName === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
        const displayName = providerName === 'openai' ? 'OpenAI' : 'Google Gemini';
        const getKeyUrl = providerName === 'openai'
            ? 'https://platform.openai.com/api-keys'
            : 'https://aistudio.google.com/apikey';

        if (provider.available) {
            return { configured: true, authMethod: 'api_key' };
        }

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: `${displayName} API key not found. What would you like to do?`,
            choices: [
                { name: `Enter ${displayName} API key`, value: 'apikey' },
                { name: `Open ${displayName} console (get key)`, value: 'open' },
                { name: `Skip ${displayName} for now`, value: 'skip' }
            ]
        }]);

        if (action === 'apikey') {
            const { apiKey } = await inquirer.prompt([{
                type: 'password',
                name: 'apiKey',
                message: `Enter your ${displayName} API key:`,
                mask: '*'
            }]);

            if (apiKey && apiKey.trim()) {
                console.log(chalk.cyan('\nAdd this to your .env file:'));
                console.log(chalk.white(`${envVar}=${apiKey}\n`));
                return { configured: true, authMethod: 'api_key' };
            }
            return { configured: false, authMethod: 'none' };
        } else if (action === 'open') {
            console.log(chalk.cyan(`\nGet your API key from: ${getKeyUrl}`));
            console.log(chalk.gray('Then add it to your .env file and re-run: janus init\n'));
            return { configured: false, authMethod: 'none' };
        }

        return { configured: false, authMethod: 'none' };
    }

    return { configured: false, authMethod: 'none' };
}

/**
 * Main onboarding wizard
 */
export async function initCommand(configManager: ConfigManager): Promise<void> {
    // Show banner
    console.log(chalk.cyan(BANNER));
    console.log(chalk.bold('Welcome to Janus - The AI War Room\n'));
    console.log(chalk.gray('Janus orchestrates debates between AI models to refine your ideas.\n'));

    // Discover providers
    console.log(chalk.bold('Discovering available AI providers...\n'));
    const discovery = await discoverProviders();

    // Display current status
    displayDiscoveryResults(discovery);

    // Check what needs setup
    const needsSetup: string[] = [];
    if (discovery.anthropic.requiresSetup) needsSetup.push('anthropic');
    if (discovery.openai.requiresSetup) needsSetup.push('openai');
    if (discovery.gemini.requiresSetup) needsSetup.push('gemini');

    // Track configured providers
    const configuredProviders: { name: string; authMethod: 'cli' | 'api_key' | 'none' }[] = [];

    // Add already-available providers
    if (discovery.anthropic.available) {
        configuredProviders.push({ name: 'anthropic', authMethod: discovery.anthropic.authMethod });
    }
    if (discovery.openai.available) {
        configuredProviders.push({ name: 'openai', authMethod: 'api_key' });
    }
    if (discovery.gemini.available) {
        configuredProviders.push({ name: 'gemini', authMethod: 'api_key' });
    }

    // If there are providers needing setup, offer to configure them
    if (needsSetup.length > 0) {
        console.log(chalk.bold('\n--- Provider Setup ---\n'));

        for (const providerName of needsSetup) {
            const result = await setupProvider(providerName, discovery);
            if (result.configured) {
                configuredProviders.push({ name: providerName, authMethod: result.authMethod });
            }
        }
    }

    // Update config with discovered auth methods
    const config = configManager.getConfig();
    const updatedConfig: JanusConfig = {
        ...config,
        active_providers: configuredProviders
            .filter(p => p.authMethod !== 'none')
            .map(p => p.name),
        providers: {
            ...config.providers
        }
    };

    // Update auth_method for anthropic if using CLI
    const anthropicConfig = configuredProviders.find(p => p.name === 'anthropic');
    if (anthropicConfig && anthropicConfig.authMethod === 'cli') {
        updatedConfig.providers.anthropic = {
            ...updatedConfig.providers.anthropic,
            auth_method: 'cli'
        };
    }

    // Save updated config
    await configManager.saveConfig(updatedConfig);

    // Final summary
    console.log(chalk.bold('\n--- Setup Complete ---\n'));

    const availableCount = configuredProviders.filter(p => p.authMethod !== 'none').length;

    if (availableCount >= 2) {
        console.log(chalk.green(`✓ ${availableCount} providers configured. You're ready to run debates!\n`));
        console.log(chalk.white('Try it out:'));
        console.log(chalk.cyan('  echo "I want to build an app that..." > idea.md'));
        console.log(chalk.cyan('  janus run ideation idea.md\n'));
    } else if (availableCount === 1) {
        console.log(chalk.yellow(`⚠ Only 1 provider configured. Janus works best with 2+ providers.\n`));
        console.log(chalk.gray('Run "janus init" again after configuring more providers.\n'));
    } else {
        console.log(chalk.red('✗ No providers configured. Janus requires at least 2 providers.\n'));
        console.log(chalk.gray('Run "janus init" again after setting up your API keys.\n'));
    }

    // Show configured providers summary
    console.log(chalk.bold('Active Providers:'));
    for (const provider of configuredProviders) {
        if (provider.authMethod !== 'none') {
            const method = provider.authMethod === 'cli' ? '(subscription)' : '(API key)';
            console.log(chalk.green(`  ✓ ${provider.name} ${chalk.gray(method)}`));
        }
    }
    console.log('');
}
