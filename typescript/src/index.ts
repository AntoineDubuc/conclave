#!/usr/bin/env node
import 'dotenv/config'; // Load .env file
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from './core/config.js';
import { ProviderFactory } from './providers/factory.js';
import { createFlowEngine, getFlowMetadata } from './flows/index.js';
import { newFlowWizard } from './commands/new-flow.js';
import { initCommand } from './commands/init.js';
import inquirer from 'inquirer';

const program = new Command();
const configManager = new ConfigManager();

// Check if this is first run (no local config file exists in cwd)
const LOCAL_CONFIG_FILE = path.join(process.cwd(), 'janus.config.yaml');

async function checkFirstRun(): Promise<boolean> {
    return !fs.existsSync(LOCAL_CONFIG_FILE);
}

async function main() {
    const isFirstRun = await checkFirstRun();

    // If first run and no specific command given, run init wizard
    if (isFirstRun && process.argv.length <= 2) {
        await initCommand(configManager);
        return;
    }

    await configManager.ensureConfig();

    program
        .name('janus')
        .description('Janus - Multi-LLM collaboration to harvest unique insights')
        .version('0.1.0');

    program
        .command('run')
        .description('Run a specific flow on a markdown file')
        .argument('<flow>', 'Name of the flow to run (e.g. ideation)')
        .argument('<file>', 'Path to the input markdown file')
        .option('-p, --prompt <prompt>', 'Override the initial prompt')
        .option('-l, --leader <provider>', 'Specify the leader provider (for leading flows)')
        .action(async (flowName, filePath, options) => {
            try {
                const config = configManager.getConfig();
                const flow = configManager.getFlow(flowName);

                if (!flow) {
                    console.error(chalk.red(`Error: Flow '${flowName}' not found.`));
                    console.log(`Available flows: ${Object.keys(config.flows).join(', ')}`);
                    process.exit(1);
                }

                const absolutePath = path.resolve(process.cwd(), filePath);
                const providers = ProviderFactory.createProviders(config);
                const flowType = flow.flow_type || 'basic';

                // Show flow explanation from metadata
                const metadata = getFlowMetadata(flowType);
                if (metadata) {
                    console.log(chalk.cyan.bold(`\n--- ${metadata.displayName} ---`));
                    console.log(chalk.gray(`Pattern: ${metadata.pattern}`));
                    console.log(chalk.gray(metadata.description));
                    console.log('');
                }

                // Handle leader selection for leading flows
                let leaderName = options.leader || flow.default_leader;
                if (flowType === 'leading' && !leaderName) {
                    const { selectedLeader } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'selectedLeader',
                            message: 'Select the leader provider:',
                            choices: providers.map(p => ({
                                name: `${p.name} - Will synthesize and lead the discussion`,
                                value: p.name
                            }))
                        }
                    ]);
                    leaderName = selectedLeader;
                }

                // Create and run the appropriate engine
                const engine = createFlowEngine(flowType, providers, flow, { leader: leaderName });
                await engine.run(absolutePath, options.prompt);

            } catch (error) {
                console.error(chalk.red('Fatal Error:'), error);
                process.exit(1);
            }
        });

    program
        .command('new-flow')
        .description('Wizard to create a new flow')
        .action(async () => {
            await newFlowWizard(configManager);
        });

    program
        .command('list')
        .description('List available flows')
        .action(() => {
            const config = configManager.getConfig();
            console.log(chalk.bold('\nAvailable Flows:\n'));
            Object.entries(config.flows).forEach(([key, flow]) => {
                const flowType = flow.flow_type || 'basic';
                const typeLabel = flowType === 'leading'
                    ? chalk.yellow('[Leading]')
                    : chalk.blue('[Basic]');
                const leaderInfo = flowType === 'leading' && flow.default_leader
                    ? chalk.gray(` (default leader: ${flow.default_leader})`)
                    : '';
                console.log(`  ${chalk.cyan.bold(key)} ${typeLabel}${leaderInfo}`);
                console.log(`    ${flow.description || 'No description'}`);
                console.log(`    Rounds: ${flow.max_rounds}\n`);
            });
        });

    program
        .command('delete-flow')
        .description('Delete an existing flow')
        .argument('<name>', 'Name of the flow to delete')
        .action(async (name) => {
            const success = configManager.removeFlow(name);
            if (success) {
                console.log(chalk.green(`Flow '${name}' deleted successfully.`));
            } else {
                console.log(chalk.red(`Flow '${name}' not found.`));
            }
        });

    program
        .command('doctor')
        .description('Check connection health and authentication status')
        .action(async () => {
            const { doctorCommand } = await import('./commands/doctor.js');
            await doctorCommand(configManager);
        });

    program
        .command('models')
        .description('List and configure active AI models')
        .action(async () => {
            const { modelsCommand } = await import('./commands/models.js');
            await modelsCommand(configManager);
        });

    program
        .command('auth-claude')
        .description('Manage Claude Code authentication')
        .action(async () => {
            const { authClaudeCommand } = await import('./commands/auth-claude.js');
            await authClaudeCommand();
        });

    program
        .command('init')
        .description('Run the setup wizard to configure providers')
        .action(async () => {
            await initCommand(configManager);
        });

    program.parse();
}

main();
