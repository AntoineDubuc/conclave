import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { JanusConfig, JanusConfigSchema, DEFAULT_CONFIG } from './types.js';

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.janus');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');

export class ConfigManager {
    private config: JanusConfig;
    private loadedConfigPath: string = path.join(os.homedir(), '.janus', 'config.yaml'); // Default

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): JanusConfig {
        // Priority 1: Current directory janus.config.yaml
        const localConfig = path.join(process.cwd(), 'janus.config.yaml');
        if (fs.existsSync(localConfig)) {
            console.log(chalk.gray(`Loaded config from: ${localConfig}`));
            this.loadedConfigPath = localConfig;
            return this.parseConfigFile(localConfig);
        }

        // Priority 2: Home directory .janus/config.yaml
        if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
            this.loadedConfigPath = GLOBAL_CONFIG_FILE;
            return this.parseConfigFile(GLOBAL_CONFIG_FILE);
        }

        this.loadedConfigPath = GLOBAL_CONFIG_FILE; // Default to global if nothing exists
        return DEFAULT_CONFIG;
    }

    private parseConfigFile(filePath: string): JanusConfig {
        try {
            const raw = yaml.load(fs.readFileSync(filePath, 'utf-8'));
            const parsed = JanusConfigSchema.safeParse(raw);

            if (!parsed.success) {
                console.warn(`Warning: Config file ${filePath} is invalid, using defaults.`, parsed.error);
                return DEFAULT_CONFIG;
            }

            // Deep merge providers to ensure new defaults (like Grok) appear even if config file is old
            const userConfig = parsed.data;
            const mergedProviders = { ...DEFAULT_CONFIG.providers, ...userConfig.providers };

            return {
                ...DEFAULT_CONFIG,
                ...userConfig,
                providers: mergedProviders
            };
        } catch (error) {
            console.error(`Error loading config from ${filePath}:`, error);
            return DEFAULT_CONFIG;
        }
    }

    public getFlow(name: string) {
        return this.config.flows[name];
    }

    public getConfig() {
        return this.config;
    }

    public removeFlow(name: string): boolean {
        if (this.config.flows[name]) {
            delete this.config.flows[name];
            this.saveConfig(this.config);
            return true;
        }
        return false;
    }

    public async saveConfig(newConfig: JanusConfig) {
        if (!fs.existsSync(path.dirname(this.loadedConfigPath))) {
            fs.mkdirSync(path.dirname(this.loadedConfigPath), { recursive: true });
        }
        fs.writeFileSync(this.loadedConfigPath, yaml.dump(newConfig));
        this.config = newConfig;
        console.log(chalk.gray(`Saved config to: ${this.loadedConfigPath}`));
    }

    // Ensures the config file exists on disk
    public async ensureConfig() {
        if (!fs.existsSync(GLOBAL_CONFIG_FILE)) {
            await this.saveConfig(DEFAULT_CONFIG);
        }
    }
}
