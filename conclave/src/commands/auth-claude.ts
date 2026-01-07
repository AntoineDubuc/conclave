import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Helper to run command safely
function runCommand(command: string, args: string[], timeoutMs = 20000): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin so we don't hang if it asks for input
        });
        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('Timed out'));
        }, timeoutMs);

        child.stdout.on('data', (data) => stdout += data);
        child.stderr.on('data', (data) => stderr += data);

        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                const err: any = new Error(`Command failed with code ${code}`);
                err.code = code;
                err.stderr = stderr;
                reject(err);
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

export async function authClaudeCommand() {
    console.log(chalk.bold('\n🔐 Claude Code Authentication Manager\n'));

    // 1. Check for API Key Conflict
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const isPlaceholder = !apiKey || apiKey.trim() === '' || apiKey.includes('sk-ant-...');

    if (apiKey && !isPlaceholder) {
        console.log(chalk.yellow('Warning: ANTHROPIC_API_KEY is present (.env).'));
        console.log('Conclave prioritizes this over Claude Code.');
    }

    // 2. Check Claude CLI Status
    console.log(chalk.bold('Checking Claude Code Status...'));
    let isAuthenticated = false;

    try {
        // Step A: Check if installed
        try {
            await runCommand('claude', ['--version'], 5000);
        } catch (err) {
            throw new Error('NOT_INSTALLED');
        }

        // Step B: Check auth
        // Using a short ping. 
        await runCommand('claude', ['-p', 'hi', '--dangerously-skip-permissions'], 25000);

        isAuthenticated = true;
        console.log(chalk.green('\n✔ Claude CLI is accessible and responding.'));

    } catch (error: any) {
        if (error.message === 'NOT_INSTALLED') {
            console.log(chalk.red('\n✖ Claude CLI not found (run `npm i -g @anthropic-ai/claude-code`).'));
        } else if (error.code === 1) {
            // Code 1 from claude probably means not authenticated
            console.log(chalk.red('\n✖ Not Authenticated.'));
        } else if (error.message === 'Timed out') {
            console.log(chalk.red('\n✖ Check timed out (Is Claude waiting for input?).'));
        } else {
            console.log(chalk.red(`\n✖ Check failed (Code ${error.code || '?'}).`));
            if (error.stderr) console.log(chalk.gray(`Output: ${error.stderr}`));
        }
    }

    console.log(''); // spacer

    const choices: string[] = [];
    if (!isAuthenticated) {
        choices.push('How to Login? (Instructions)');
    }
    choices.push('Test Connection (Conclave Doctor)');
    choices.push('Exit');

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: choices
    }]);

    if (action === 'How to Login? (Instructions)') {
        console.log(chalk.cyan('\nTo login to Claude Code:'));
        console.log('1. Open a new terminal window.');
        console.log('2. Run: ' + chalk.bold('claude'));
        console.log('3. Follow the authentication flow.');
        console.log('4. Run ' + chalk.bold('conclave auth-claude') + ' again.\n');
    } else if (action === 'Test Connection (Conclave Doctor)') {
        const { doctorCommand } = await import('./doctor.js');
        const { ConfigManager } = await import('../core/config.js');
        await doctorCommand(new ConfigManager());
    }
}
