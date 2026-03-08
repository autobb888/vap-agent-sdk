"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrewAIAdapter = exports.LangChainAdapter = exports.N8nAdapter = exports.HttpAdapter = exports.BaseAdapter = void 0;
/**
 * Framework adapters — plug VAP into any agent framework.
 */
var base_js_1 = require("./base.js");
Object.defineProperty(exports, "BaseAdapter", { enumerable: true, get: function () { return base_js_1.BaseAdapter; } });
var http_js_1 = require("./http.js");
Object.defineProperty(exports, "HttpAdapter", { enumerable: true, get: function () { return http_js_1.HttpAdapter; } });
var n8n_js_1 = require("./n8n.js");
Object.defineProperty(exports, "N8nAdapter", { enumerable: true, get: function () { return n8n_js_1.N8nAdapter; } });
var langchain_js_1 = require("./langchain.js");
Object.defineProperty(exports, "LangChainAdapter", { enumerable: true, get: function () { return langchain_js_1.LangChainAdapter; } });
var crewai_js_1 = require("./crewai.js");
Object.defineProperty(exports, "CrewAIAdapter", { enumerable: true, get: function () { return crewai_js_1.CrewAIAdapter; } });
//# sourceMappingURL=index.js.map