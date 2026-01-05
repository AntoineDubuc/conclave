import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../core/config.js';
import { ProviderFactory } from '../providers/factory.js';

export async function doctorCommand(configManager: ConfigManager) {
    // console.log(chalk.bold('\n🏥 Janus Doctor\n'));

    const config = configManager.getConfig();
    const providers = ProviderFactory.createProviders(config);

    for (const provider of providers) {
        // Determine what label to show
        let label = provider.name;
        let spinner = ora(chalk.bold(label)).start();

        try {
            // Identify Auth Method
            let authInfo = "";
            let isValid = false;
            let message = "";

            if (provider.name === 'Anthropic') {
                authInfo = "API Key";
            } else if (provider.name === 'Anthropic (CLI)') {
                authInfo = "Claude Code Plan";
            } else {
                authInfo = "API Key";
            }

            // Ping Test
            const response = await provider.generate("Return 'OK'", { maxTokens: 1 });

            if (response.startsWith('[Error]')) {
                throw new Error(response);
            }

            isValid = true;
            message = "Valid";

            spinner.stop();
            console.log(`${chalk.bold(provider.name)}: ${chalk.green(message)} (${authInfo})`);

        } catch (error: any) {
            spinner.stop();
            let errorMsg = error.message || "Unknown Error";
            // Simplify common errors
            if (errorMsg.includes("401")) errorMsg = "Invalid API Key";
            if (errorMsg.includes("404")) errorMsg = "Model Not Found / Wrapper Error";

            console.log(`${chalk.bold(provider.name)}: ${chalk.red('Invalid')} (${errorMsg})`);
        }
    }
}
