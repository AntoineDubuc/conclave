import inquirer from 'inquirer';
import { ConfigManager } from '../core/config.js';
import { FlowConfig } from '../core/types.js';

export async function newFlowWizard(configManager: ConfigManager) {
    console.log('--- Conclave Flow Wizard ---\n');

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Flow Name (e.g. "code-audit"):',
            validate: (input) => input.length > 0 ? true : "Name cannot be empty"
        },
        {
            type: 'input',
            name: 'description',
            message: 'Description:'
        },
        {
            type: 'checkbox',
            name: 'active_providers',
            message: 'Select providers for this flow (Press Space to select, Enter to confirm):',
            choices: Object.keys(configManager.getConfig().providers),
            default: configManager.getConfig().active_providers
        },
        {
            type: 'number',
            name: 'max_rounds',
            message: 'Max Rounds:',
            default: 2
        },
        {
            type: 'editor',
            name: 'round_1_prompt',
            message: 'Enter the Prompt for Round 1 (Divergence):',
            default: "Analyze this..."
        },
        {
            type: 'editor',
            name: 'refinement_prompt',
            message: 'Enter the Refinement Prompt (Round 2..N):',
            default: "Review peer feedback and improve..."
        }
    ]);

    const newFlow: any = {
        name: answers.name,
        description: answers.description,
        max_rounds: answers.max_rounds,
        active_providers: answers.active_providers.length > 0 ? answers.active_providers : undefined,
        prompts: {
            round_1: answers.round_1_prompt,
            refinement: answers.refinement_prompt
        }
    };

    const config = configManager.getConfig();
    config.flows[answers.name] = newFlow;

    await configManager.saveConfig(config);
    console.log(`\nFlow '${answers.name}' saved successfully!`);
}
