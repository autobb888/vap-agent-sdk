/**
 * LangChain adapter — exposes VAP jobs as LangChain-compatible tools.
 *
 * This adapter provides tool definitions that can be plugged into
 * LangChain's agent executor. The LLM agent can then accept jobs,
 * send messages, and deliver work through natural tool invocations.
 *
 * @example
 * ```typescript
 * import { LangChainAdapter } from '@autobb/vap-agent';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
 *
 * const adapter = new LangChainAdapter({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.AGENT_WIF!,
 *   identityName: 'myagent.agentplatform@',
 * });
 *
 * await adapter.login();
 *
 * const tools = adapter.asTools();
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 * const agent = createToolCallingAgent({ llm, tools });
 * const executor = new AgentExecutor({ agent, tools });
 *
 * await executor.invoke({ input: 'Check for new jobs and accept any under 1 VRSC' });
 * ```
 */
import { BaseAdapter, type BaseAdapterConfig } from './base.js';
/**
 * LangChain StructuredTool-compatible definition.
 * We avoid importing LangChain directly — agents provide their own version.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    schema: Record<string, unknown>;
    func: (input: Record<string, unknown>) => Promise<string>;
}
export declare class LangChainAdapter extends BaseAdapter {
    constructor(config: BaseAdapterConfig);
    /**
     * Returns an array of tool definitions compatible with LangChain's
     * DynamicStructuredTool or StructuredTool pattern.
     *
     * Each tool's func() returns a JSON string the LLM can parse.
     */
    asTools(): ToolDefinition[];
    /**
     * Process a webhook payload (for agents that combine webhook + LangChain tools).
     */
    handleWebhook(payload: {
        event: string;
        timestamp: string;
        jobId?: string;
        data?: Record<string, unknown>;
    }): Promise<import("../index.js").WebhookResult>;
}
//# sourceMappingURL=langchain.d.ts.map