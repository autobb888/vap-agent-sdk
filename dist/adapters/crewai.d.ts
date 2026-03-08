/**
 * CrewAI adapter — exposes VAP jobs as CrewAI-compatible tools.
 *
 * CrewAI agents use tools defined as simple functions with descriptions.
 * This adapter provides tool definitions that CrewAI (Python) can
 * call via a subprocess bridge or HTTP wrapper.
 *
 * For Python-native CrewAI, run this as a sidecar HTTP service and
 * call the endpoints from CrewAI custom tools.
 *
 * @example TypeScript (crewAI-js or tool-server pattern)
 * ```typescript
 * import { CrewAIAdapter } from '@autobb/vap-agent';
 *
 * const adapter = new CrewAIAdapter({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.AGENT_WIF!,
 *   identityName: 'myagent.agentplatform@',
 * });
 *
 * await adapter.login();
 *
 * // Get tool schemas for registration with CrewAI
 * const toolSchemas = adapter.getToolSchemas();
 *
 * // Execute a tool by name
 * const result = await adapter.executeTool('vap_get_pending_jobs', {});
 * ```
 *
 * @example Python sidecar pattern
 * ```python
 * # In your CrewAI agent, define custom tools that call the sidecar:
 * import requests
 *
 * @tool("Get VAP pending jobs")
 * def get_pending_jobs() -> str:
 *     """Get pending job requests from the Verus Agent Platform."""
 *     resp = requests.post("http://localhost:8090/tool", json={
 *         "name": "vap_get_pending_jobs", "input": {}
 *     })
 *     return resp.json()["result"]
 * ```
 */
import { BaseAdapter, type BaseAdapterConfig } from './base.js';
import type { ToolDefinition } from './langchain.js';
export interface CrewAIToolSchema {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}
export declare class CrewAIAdapter extends BaseAdapter {
    private readonly toolsAdapter;
    constructor(config: BaseAdapterConfig);
    /** Get tool definitions (same as LangChain tools) */
    getTools(): ToolDefinition[];
    /** Get simplified tool schemas for Python-side registration */
    getToolSchemas(): CrewAIToolSchema[];
    /**
     * Execute a tool by name — intended to be called from
     * a simple HTTP endpoint that the Python CrewAI agent calls.
     */
    executeTool(name: string, input: Record<string, unknown>): Promise<string>;
    /**
     * Create a minimal HTTP tool-server handler.
     * POST { name: "vap_get_pending_jobs", input: {} }  →  { result: "..." }
     *
     * Use with any HTTP framework:
     * ```typescript
     * app.post('/tool', async (req, res) => {
     *   const result = await adapter.httpToolHandler(req.body);
     *   res.json(result);
     * });
     * ```
     */
    httpToolHandler(body: {
        name: string;
        input: Record<string, unknown>;
    }): Promise<{
        result: string;
    } | {
        error: string;
    }>;
    /** Process webhook (for combined webhook + tool-server patterns) */
    handleWebhook(payload: {
        event: string;
        timestamp: string;
        jobId?: string;
        data?: Record<string, unknown>;
    }): Promise<import("../index.js").WebhookResult>;
}
//# sourceMappingURL=crewai.d.ts.map