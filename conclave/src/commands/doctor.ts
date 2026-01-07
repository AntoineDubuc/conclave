import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../core/config.js';
import { ProviderFactory } from '../providers/factory.js';
import { discoverProviders, displayDiscoveryResults, getAvailableProviderNames } from '../core/provider-discovery.js';

export async function doctorCommand(configManager: ConfigManager) {
    console.log(chalk.bold('\n🏥 Conclave Health Check\n'));

    // Phase 1: Discovery
    console.log(chalk.gray('Discovering providers...\n'));
    const discovery = await discoverProviders();

    displayDiscoveryResults(discovery);

    // Phase 2: Connection Tests
    const availableProviders = getAvailableProviderNames(discovery);

    if (availableProviders.length === 0) {
        console.log(chalk.red('\n✗ No providers available. Run "conclave init" to set up.\n'));
        return;
    }

    console.log(chalk.bold('\n--- Connection Tests ---\n'));

    const config = configManager.getConfig();
    const providers = ProviderFactory.createProviders(config);

    for (const provider of providers) {
        const spinner = ora(chalk.bold(provider.name)).start();

        try {
            // Identify Auth Method
            let authInfo = "";

            if (provider.name === 'Anthropic') {
                authInfo = "API Key";
            } else if (provider.name === 'Anthropic (CLI)') {
                authInfo = "Subscription";
            } else {
                authInfo = "API Key";
            }

            // Ping Test
            const response = await provider.generate("Reply with just: OK", { maxTokens: 10 });

            if (response.startsWith('[Error]')) {
                throw new Error(response);
            }

            spinner.succeed(`${chalk.bold(provider.name)}: ${chalk.green('Connected')} (${authInfo})`);

        } catch (error: any) {
            let errorMsg = error.message || "Unknown Error";
            // Simplify common errors
            if (errorMsg.includes("401")) errorMsg = "Invalid API Key";
            if (errorMsg.includes("404")) errorMsg = "Model Not Found";
            if (errorMsg.includes("rate limit")) errorMsg = "Rate Limited";

            spinner.fail(`${chalk.bold(provider.name)}: ${chalk.red('Failed')} (${errorMsg})`);
        }
    }

    // Summary
    console.log(chalk.bold('\n--- Summary ---\n'));

    const minProviders = 2;
    if (availableProviders.length >= minProviders) {
        console.log(chalk.green(`✓ ${availableProviders.length} providers ready. Conclave is operational!\n`));
    } else {
        console.log(chalk.yellow(`⚠ Only ${availableProviders.length} provider(s) available.`));
        console.log(chalk.gray(`  Conclave works best with at least ${minProviders} providers for debates.\n`));
    }
}
