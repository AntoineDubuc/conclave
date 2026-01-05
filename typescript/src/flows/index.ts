import * as basic from './basic/index.js';
import * as leading from './leading/index.js';
import { Provider } from '../providers/base.js';

// Registry of all available flow types
export const flows = {
    basic,
    leading,
} as const;

export type FlowType = keyof typeof flows;

// Flow config interface (what comes from janus.config.yaml)
export interface FlowConfig {
    name: string;
    description?: string;
    flow_type?: string;
    max_rounds: number;
    default_leader?: string;
    active_providers?: string[];
    prompts: {
        round_1: string;
        refinement: string;
        leader_synthesis?: string;
    };
}

// Options passed when creating a flow engine
export interface FlowEngineOptions {
    leader?: string;
}

/**
 * Get metadata for a flow type.
 */
export function getFlowMetadata(flowType: string) {
    const flow = flows[flowType as FlowType];
    return flow?.metadata;
}

/**
 * Get all registered flow types and their metadata.
 */
export function getAllFlowMetadata() {
    return Object.entries(flows).map(([key, flow]) => ({
        ...flow.metadata,
        type: key, // Override with the registry key
    }));
}

/**
 * Create a flow engine instance for the given flow type.
 * Returns the appropriate engine based on flow_type in config.
 */
export function createFlowEngine(
    flowType: string,
    providers: Provider[],
    flowConfig: FlowConfig,
    options?: FlowEngineOptions
) {
    if (!isValidFlowType(flowType)) {
        const available = Object.keys(flows).join(', ');
        throw new Error(`Unknown flow type: '${flowType}'. Available types: ${available}`);
    }

    // Each flow type may have different constructor requirements
    switch (flowType) {
        case 'leading': {
            const leaderName = options?.leader || flowConfig.default_leader;
            if (!leaderName) {
                throw new Error('Leading flow requires a leader. Specify --leader or set default_leader in config.');
            }
            return new leading.Engine(providers, flowConfig, leaderName);
        }
        case 'basic':
        default:
            return new basic.Engine(providers, flowConfig);
    }
}

/**
 * Check if a flow type exists in the registry.
 */
export function isValidFlowType(flowType: string): flowType is FlowType {
    return flowType in flows;
}
