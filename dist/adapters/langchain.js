"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangChainAdapter = void 0;
const base_js_1 = require("./base.js");
class LangChainAdapter extends base_js_1.BaseAdapter {
    constructor(config) {
        super(config);
    }
    /**
     * Returns an array of tool definitions compatible with LangChain's
     * DynamicStructuredTool or StructuredTool pattern.
     *
     * Each tool's func() returns a JSON string the LLM can parse.
     */
    asTools() {
        return [
            {
                name: 'vap_get_pending_jobs',
                description: 'Get all pending job requests waiting for this agent to accept or reject.',
                schema: { type: 'object', properties: {} },
                func: async () => {
                    const jobs = await this.agent.getPendingJobs();
                    return JSON.stringify(jobs.map(summarizeJob));
                },
            },
            {
                name: 'vap_get_active_jobs',
                description: 'Get all active jobs (accepted or in progress) for this agent.',
                schema: { type: 'object', properties: {} },
                func: async () => {
                    const jobs = await this.agent.getActiveJobs();
                    return JSON.stringify(jobs.map(summarizeJob));
                },
            },
            {
                name: 'vap_get_job',
                description: 'Get details of a specific job by ID.',
                schema: {
                    type: 'object',
                    properties: { jobId: { type: 'string', description: 'The job ID' } },
                    required: ['jobId'],
                },
                func: async (input) => {
                    const job = await this.agent.getJob(input.jobId);
                    return JSON.stringify(summarizeJob(job));
                },
            },
            {
                name: 'vap_accept_job',
                description: 'Accept a pending job request. Signs the acceptance with your VerusID.',
                schema: {
                    type: 'object',
                    properties: { jobId: { type: 'string', description: 'The job ID to accept' } },
                    required: ['jobId'],
                },
                func: async (input) => {
                    const job = await this.agent.acceptJob(input.jobId);
                    return JSON.stringify({ success: true, jobId: job.id, status: job.status });
                },
            },
            {
                name: 'vap_deliver_job',
                description: 'Deliver completed work for a job. Signs the delivery with your VerusID.',
                schema: {
                    type: 'object',
                    properties: {
                        jobId: { type: 'string', description: 'The job ID to deliver' },
                        content: { type: 'string', description: 'The delivery content/work product' },
                    },
                    required: ['jobId', 'content'],
                },
                func: async (input) => {
                    const job = await this.agent.deliverJob(input.jobId, input.content);
                    return JSON.stringify({ success: true, jobId: job.id, status: job.status });
                },
            },
            {
                name: 'vap_send_message',
                description: 'Send a chat message to the buyer on a job.',
                schema: {
                    type: 'object',
                    properties: {
                        jobId: { type: 'string', description: 'The job ID' },
                        message: { type: 'string', description: 'The message to send' },
                    },
                    required: ['jobId', 'message'],
                },
                func: async (input) => {
                    await this.agent.sendMessage(input.jobId, input.message);
                    return JSON.stringify({ success: true, jobId: input.jobId });
                },
            },
            {
                name: 'vap_get_messages',
                description: 'Get chat messages for a job.',
                schema: {
                    type: 'object',
                    properties: { jobId: { type: 'string', description: 'The job ID' } },
                    required: ['jobId'],
                },
                func: async (input) => {
                    const messages = await this.agent.getMessages(input.jobId);
                    return JSON.stringify(messages);
                },
            },
        ];
    }
    /**
     * Process a webhook payload (for agents that combine webhook + LangChain tools).
     */
    async handleWebhook(payload) {
        return this.processWebhook(payload);
    }
}
exports.LangChainAdapter = LangChainAdapter;
function summarizeJob(job) {
    return {
        id: job.id,
        status: job.status,
        description: job.description,
        amount: job.amount,
        currency: job.currency,
        buyerVerusId: job.buyerVerusId,
        sellerVerusId: job.sellerVerusId,
        createdAt: job.createdAt,
    };
}
//# sourceMappingURL=langchain.js.map