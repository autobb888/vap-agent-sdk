"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrewAIAdapter = void 0;
const base_js_1 = require("./base.js");
const langchain_js_1 = require("./langchain.js");
class CrewAIAdapter extends base_js_1.BaseAdapter {
    toolsAdapter;
    constructor(config) {
        super(config);
        // Reuse LangChain adapter's tool definitions (same shape)
        this.toolsAdapter = new langchain_js_1.LangChainAdapter(config);
    }
    /** Get tool definitions (same as LangChain tools) */
    getTools() {
        return this.toolsAdapter.asTools();
    }
    /** Get simplified tool schemas for Python-side registration */
    getToolSchemas() {
        return this.getTools().map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.schema,
        }));
    }
    /**
     * Execute a tool by name — intended to be called from
     * a simple HTTP endpoint that the Python CrewAI agent calls.
     */
    async executeTool(name, input) {
        const tools = this.getTools();
        const tool = tools.find(t => t.name === name);
        if (!tool)
            throw new Error(`Unknown tool: ${name}`);
        return tool.func(input);
    }
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
    async httpToolHandler(body) {
        try {
            const result = await this.executeTool(body.name, body.input);
            return { result };
        }
        catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    }
    /** Process webhook (for combined webhook + tool-server patterns) */
    async handleWebhook(payload) {
        return this.processWebhook(payload);
    }
}
exports.CrewAIAdapter = CrewAIAdapter;
//# sourceMappingURL=crewai.js.map