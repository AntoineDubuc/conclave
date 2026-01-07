import inquirer from 'inquirer';
import chalk from 'chalk/index.js';
import { ConfigManager } from '../core/config.js';

// Hardcoded state-of-the-art models for Jan 2026
const KNOWN_MODELS = {
    anthropic: [
        'claude-sonnet-4-5-20250929',
        'claude-opus-4-5-20251101',
        'claude-haiku-4-5-20251001',
        'claude-3-5-sonnet-20240620' // Legacy
    ],
    openai: [
        'gpt-5.2-pro', // High Performance / Reasoning
        'gpt-5.2',     // Flagship
        'gpt-4.1',     // Versatile
        'gpt-5-mini',  // Efficient
        'gpt-4o'       // Legacy
    ],
    gemini: [
        'gemini-3-flash',
        'gemini-3-pro',
        'gemini-1.5-pro' // Legacy
    ],
    grok: [
        'grok-4',
        'grok-4.1',
        'grok-code-fast-1'
    ]
};

export async function modelsCommand(configManager: ConfigManager) {
    const config = configManager.getConfig();
    console.log(chalk.bold('\n🤖 AI Model Configuration\n'));

    while (true) {
        // 1. Select Provider to Edit
        const choices: any[] = [
            ...Object.keys(config.providers),
            new inquirer.Separator(),
            { name: '❌ Exit', value: 'EXIT' }
        ];

        const { provider } = await inquirer.prompt([{
            type: 'list',
            name: 'provider',
            message: 'Select a provider to configure:',
            choices: choices,
            pageSize: 10
        }]);

        if (provider === 'EXIT') {
            break;
        }

        const currentModel = config.providers[provider].model;
        console.log(`Current model for ${chalk.cyan(provider)}: ${chalk.green(currentModel)}`);

        // 2. Select New Model (from presets or custom)
        const modelChoices: any[] = [
            { name: '⬅️  Go Back', value: 'BACK' },
            new inquirer.Separator(),
            ...(KNOWN_MODELS[provider as keyof typeof KNOWN_MODELS] || []),
            new inquirer.Separator(),
            'Enter Custom Model ID...'
        ];

        const { modelChoice } = await inquirer.prompt([{
            type: 'list',
            name: 'modelChoice',
            message: `Choose a model for ${provider}:`,
            choices: modelChoices,
            pageSize: 12
        }]);

        if (modelChoice === 'BACK') {
            console.clear();
            console.log(chalk.bold('\n🤖 AI Model Configuration\n'));
            continue;
        }

        let newModel = modelChoice;

        if (modelChoice === 'Enter Custom Model ID...') {
            const { customModel } = await inquirer.prompt([{
                type: 'input',
                name: 'customModel',
                message: 'Enter the exact API model ID:',
                validate: (input) => input.length > 0 ? true : "Model ID cannot be empty"
            }]);
            newModel = customModel;
        }

        // 3. Save
        config.providers[provider].model = newModel;
        await configManager.saveConfig(config);

        console.log(chalk.green(`\n✔ Updated ${provider} to use model: ${newModel}\n`));
    }
}
