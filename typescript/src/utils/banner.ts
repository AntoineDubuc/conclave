/**
 * ASCII banner utilities for Conclave CLI.
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
 * Print the Conclave ASCII art banner with gradient colors.
 */
export function printBanner(subtitle?: string): void {
    const asciiArt = figlet.textSync('CONCLAVE', { font: 'Banner3' });
    const lines = asciiArt.split('\n');

    // Print with left-to-right gradient effect
    lines.forEach((line) => {
        if (line.trim()) {
            const trimmedLine = line.trimEnd();
            const lineLen = trimmedLine.length;
            let coloredLine = '';
            for (let j = 0; j < trimmedLine.length; j++) {
                // Calculate color index based on horizontal position
                const colorIdx = Math.floor(j / Math.max(lineLen - 1, 1) * (GRADIENT_COLORS.length - 1));
                const color = GRADIENT_COLORS[colorIdx];
                coloredLine += color.bold(trimmedLine[j]);
            }
            console.log(coloredLine);
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
    return figlet.textSync('CONCLAVE', { font: 'Banner3' });
}
