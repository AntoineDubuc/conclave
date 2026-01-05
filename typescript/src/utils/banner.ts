/**
 * ASCII banner utilities for Janus CLI.
 */

import figlet from 'figlet';
import chalk from 'chalk';

// Gradient colors from yellow to orange
const GRADIENT_COLORS = [
    chalk.hex('#FFFF00'),  // bright yellow
    chalk.hex('#FFD700'),  // gold/yellow
    chalk.hex('#FFA500'),  // orange
    chalk.hex('#FF8C00'),  // dark orange
    chalk.hex('#FF4500'),  // orange red
];

/**
 * Print the Janus ASCII art banner with gradient colors.
 */
export function printBanner(subtitle?: string): void {
    const asciiArt = figlet.textSync('JANUS', { font: 'Banner3' });
    const lines = asciiArt.split('\n');

    // Print with gradient effect
    lines.forEach((line, i) => {
        if (line.trim()) {
            const color = GRADIENT_COLORS[i % GRADIENT_COLORS.length];
            console.log(color.bold(line));
        }
    });

    // Print subtitle
    if (subtitle) {
        console.log(chalk.gray(subtitle));
    } else {
        console.log(chalk.gray('Multi-LLM collaboration CLI'));
    }
}

/**
 * Get the raw ASCII banner text without colors.
 */
export function getBannerText(): string {
    return figlet.textSync('JANUS', { font: 'Banner3' });
}
