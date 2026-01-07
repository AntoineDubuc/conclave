import { spawn } from 'child_process';
import chalk from 'chalk/index.js';

export interface ClaudeCliStatus {
    installed: boolean;
    version?: string;
    authenticated: boolean;
    authMethod?: 'subscription' | 'api_key';
    error?: string;
}

interface CommandResult {
    stdout: string;
    stderr: string;
    code: number | null;
}

/**
 * Run a command with timeout and capture output
 */
function runCommand(command: string, args: string[], timeoutMs = 15000): Promise<CommandResult> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            child.kill();
            resolve({ stdout, stderr, code: null });
        }, timeoutMs);

        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
        });

        child.on('error', () => {
            clearTimeout(timer);
            resolve({ stdout, stderr, code: -1 });
        });
    });
}

/**
 * Check if Claude CLI is installed and get version
 */
async function checkInstalled(): Promise<{ installed: boolean; version?: string }> {
    const result = await runCommand('claude', ['--version'], 5000);

    if (result.code === 0 && result.stdout) {
        // Parse version from output like "claude 2.0.76"
        const match = result.stdout.match(/claude\s+([\d.]+)/i) || result.stdout.match(/([\d.]+)/);
        return {
            installed: true,
            version: match ? match[1] : result.stdout
        };
    }

    return { installed: false };
}

/**
 * Check if Claude CLI is authenticated by running a minimal prompt
 */
async function checkAuthenticated(): Promise<{ authenticated: boolean; error?: string }> {
    // Run a minimal prompt to test authentication
    // Using --output-format json for structured response if available
    const result = await runCommand(
        'claude',
        ['-p', 'Reply with just: ok', '--dangerously-skip-permissions'],
        20000 // 20s timeout for auth check
    );

    if (result.code === 0) {
        return { authenticated: true };
    }

    // Check for common auth error patterns
    const output = (result.stderr + result.stdout).toLowerCase();

    if (output.includes('not authenticated') ||
        output.includes('invalid api key') ||
        output.includes('unauthorized') ||
        output.includes('login') ||
        output.includes('401')) {
        return {
            authenticated: false,
            error: 'Not authenticated. Run "claude" to log in.'
        };
    }

    if (result.code === null) {
        return {
            authenticated: false,
            error: 'Authentication check timed out.'
        };
    }

    return {
        authenticated: false,
        error: result.stderr || `CLI exited with code ${result.code}`
    };
}

/**
 * Get complete Claude CLI status
 */
export async function getClaudeCliStatus(): Promise<ClaudeCliStatus> {
    // Step 1: Check if installed
    const installCheck = await checkInstalled();

    if (!installCheck.installed) {
        return {
            installed: false,
            authenticated: false,
            error: 'Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code'
        };
    }

    // Step 2: Check if authenticated
    const authCheck = await checkAuthenticated();

    // Determine auth method
    const hasApiKey = process.env.ANTHROPIC_API_KEY &&
        !process.env.ANTHROPIC_API_KEY.includes('sk-ant-...');

    return {
        installed: true,
        version: installCheck.version,
        authenticated: authCheck.authenticated,
        authMethod: hasApiKey ? 'api_key' : 'subscription',
        error: authCheck.error
    };
}

/**
 * Display Claude CLI status in a formatted way
 */
export function displayClaudeStatus(status: ClaudeCliStatus): void {
    console.log(chalk.bold('\nClaude (Anthropic):'));

    if (!status.installed) {
        console.log(chalk.red('  ✗ Claude CLI not installed'));
        console.log(chalk.gray('    Install: npm install -g @anthropic-ai/claude-code'));
        return;
    }

    console.log(chalk.green(`  ✓ Claude CLI installed (v${status.version})`));

    if (status.authenticated) {
        if (status.authMethod === 'subscription') {
            console.log(chalk.green('  ✓ Authenticated via subscription'));
            console.log(chalk.cyan('  → Using your Pro/Max plan (no API charges)'));
        } else {
            console.log(chalk.green('  ✓ Authenticated via API key'));
            console.log(chalk.yellow('  → Using pay-per-token billing'));
        }
    } else {
        console.log(chalk.red('  ✗ Not authenticated'));
        if (status.error) {
            console.log(chalk.gray(`    ${status.error}`));
        }
    }
}

/**
 * Interactive login flow - opens Claude CLI for user to authenticate
 */
export async function promptClaudeLogin(): Promise<boolean> {
    console.log(chalk.cyan('\nOpening Claude CLI for authentication...'));
    console.log(chalk.gray('Complete the login in the browser, then return here.\n'));

    return new Promise((resolve) => {
        // Spawn interactive claude session
        const child = spawn('claude', [], {
            stdio: 'inherit', // Pass through to user's terminal
            shell: true
        });

        child.on('close', async (code) => {
            if (code === 0) {
                // Verify authentication worked
                const status = await getClaudeCliStatus();
                resolve(status.authenticated);
            } else {
                resolve(false);
            }
        });

        child.on('error', () => {
            console.log(chalk.red('Failed to start Claude CLI'));
            resolve(false);
        });
    });
}

/**
 * Quick health check - returns true if Claude CLI is ready to use
 * This is a fast check suitable for runtime validation
 */
export async function isClaudeReady(): Promise<boolean> {
    const status = await getClaudeCliStatus();
    return status.installed && status.authenticated;
}
