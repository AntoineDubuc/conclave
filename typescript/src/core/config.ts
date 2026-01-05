import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { JanusConfig, JanusConfigSchema, DEFAULT_CONFIG } from './types.js';

// Local-first: config lives in the current working directory
const LOCAL_CONFIG_FILE = 'janus.config.yaml';

export class ConfigManager {
    private config: JanusConfig;
    private loadedConfigPath: string;

    constructor() {
        this.loadedConfigPath = path.join(process.cwd(), LOCAL_CONFIG_FILE);
        this.config = this.loadConfig();
    }

    private loadConfig(): JanusConfig {
        // Only use local config in current working directory
        const localConfig = path.join(process.cwd(), LOCAL_CONFIG_FILE);
        if (fs.existsSync(localConfig)) {
            console.log(chalk.gray(`Loaded config from: ${localConfig}`));
            this.loadedConfigPath = localConfig;
            return this.parseConfigFile(localConfig);
        }

        // No config found - use defaults (will create locally on first save)
        this.loadedConfigPath = localConfig;
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

    // Ensures the config file exists on disk (locally in cwd)
    public async ensureConfig() {
        if (!fs.existsSync(this.loadedConfigPath)) {
            await this.saveConfig(DEFAULT_CONFIG);
        }
    }
}
