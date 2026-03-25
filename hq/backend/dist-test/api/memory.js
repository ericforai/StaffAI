"use strict";
/**
 * Memory API Routes
 *
 * Provides HTTP endpoints for memory retrieval operations.
 * All routes follow the pattern /api/memory/*
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMemoryRoutes = registerMemoryRoutes;
var file_memory_retriever_1 = require("../memory/file-memory-retriever");
/**
 * Parse and validate positive integer from query parameter
 */
function readPositiveInt(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return undefined;
    }
    var num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (Number.isFinite(num) && num > 0) {
        return Math.floor(num);
    }
    return undefined;
}
/**
 * Parse boolean from query parameter
 */
function readBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true' || value === '1';
    }
    return false;
}
/**
 * Parse memory document types from query parameter
 */
function readDocumentTypes(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    var validTypes = new Set(['project', 'task', 'decision', 'knowledge', 'agent']);
    var types = value.split(',').map(function (t) { return t.trim().toLowerCase(); });
    var filtered = types.filter(function (t) { return validTypes.has(t); });
    return filtered.length > 0 ? filtered : undefined;
}
/**
 * Parse time range from query parameters
 */
function readTimeRange(startStr, endStr) {
    var start = startStr ? new Date(startStr) : undefined;
    var end = endStr ? new Date(endStr) : undefined;
    if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
        return undefined;
    }
    if (start || end) {
        return { start: start !== null && start !== void 0 ? start : new Date(0), end: end !== null && end !== void 0 ? end : new Date() };
    }
    return undefined;
}
/**
 * Build retrieve options from express request query
 */
function buildRetrieveOptions(query) {
    var options = {};
    var limit = readPositiveInt(query.limit);
    if (limit !== undefined) {
        options.limit = limit;
    }
    var threshold = readPositiveInt(query.threshold);
    if (threshold !== undefined) {
        options.threshold = threshold;
    }
    if (query.includeFullContent !== undefined) {
        options.includeFullContent = readBoolean(query.includeFullContent);
    }
    var documentTypes = readDocumentTypes(query.documentTypes);
    if (documentTypes !== undefined) {
        options.documentTypes = documentTypes;
    }
    var timeRange = readTimeRange(query.timeRangeStart, query.timeRangeEnd);
    if (timeRange !== undefined) {
        options.timeRange = timeRange;
    }
    var excerptMaxChars = readPositiveInt(query.excerptMaxChars);
    if (excerptMaxChars !== undefined) {
        options.excerptMaxChars = excerptMaxChars;
    }
    var contextMaxChars = readPositiveInt(query.contextMaxChars);
    if (contextMaxChars !== undefined) {
        options.contextMaxChars = contextMaxChars;
    }
    if (query.fallbackMode === 'none' || query.fallbackMode === 'recent') {
        options.fallbackMode = query.fallbackMode;
    }
    return options;
}
/**
 * Register memory retrieval routes
 */
function registerMemoryRoutes(app, dependencies) {
    var _this = this;
    var memoryRootDir = dependencies.memoryRootDir;
    // Create retriever instance
    var createRetriever = function () {
        return (0, file_memory_retriever_1.createMemoryRetriever)({
            memoryRootDir: memoryRootDir,
            cacheTtlMs: 300000, // 5 minutes
            enableCache: true,
        });
    };
    /**
     * GET /api/memory/retrieve
     *
     * General memory retrieval across all document types.
     *
     * Query params:
     * - query: string (required) - Search query
     * - limit: number - Max results (default: 3)
     * - threshold: number - Minimum score (default: 0)
     * - includeFullContent: boolean - Include full content
     * - documentTypes: string - Comma-separated types (project,task,decision,knowledge,agent)
     * - timeRangeStart: string - ISO date string
     * - timeRangeEnd: string - ISO date string
     * - excerptMaxChars: number - Max chars per excerpt (default: 300)
     * - contextMaxChars: number - Max total chars in context (default: 1600)
     * - fallbackMode: 'none' | 'recent' - Fallback behavior (default: recent)
     */
    app.get('/api/memory/retrieve', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var query, options, retriever, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = typeof req.query.q === 'string' ? req.query.q : '';
                    if (!query.trim()) {
                        return [2 /*return*/, res.status(400).json({
                                error: 'query parameter "q" is required',
                            })];
                    }
                    options = buildRetrieveOptions(req.query);
                    retriever = createRetriever();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, retriever.retrieve(query, options)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, res.json(result)];
                case 3:
                    error_1 = _a.sent();
                    return [2 /*return*/, res.status(500).json({
                            error: 'Memory retrieval failed',
                            message: error_1 instanceof Error ? error_1.message : String(error_1),
                        })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    /**
     * GET /api/memory/tasks/:taskId
     *
     * Retrieve memory context for a specific task.
     *
     * Path params:
     * - taskId: string - Task identifier
     *
     * Query params: same as /api/memory/retrieve
     */
    app.get('/api/memory/tasks/:taskId', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var taskId, query, options, retriever, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    taskId = req.params.taskId;
                    query = typeof req.query.q === 'string' ? req.query.q : '';
                    options = buildRetrieveOptions(req.query);
                    retriever = createRetriever();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, retriever.retrieveForTask(query, taskId, options)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, res.json(result)];
                case 3:
                    error_2 = _a.sent();
                    return [2 /*return*/, res.status(500).json({
                            error: 'Task memory retrieval failed',
                            message: error_2 instanceof Error ? error_2.message : String(error_2),
                        })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    /**
     * GET /api/memory/decisions
     *
     * Retrieve decision records matching a query.
     *
     * Query params:
     * - q: string (required) - Search query
     * - Other params same as /api/memory/retrieve
     */
    app.get('/api/memory/decisions', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var query, options, retriever, result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = typeof req.query.q === 'string' ? req.query.q : '';
                    if (!query.trim()) {
                        return [2 /*return*/, res.status(400).json({
                                error: 'query parameter "q" is required',
                            })];
                    }
                    options = buildRetrieveOptions(req.query);
                    retriever = createRetriever();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, retriever.retrieveDecisions(query, options)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, res.json(result)];
                case 3:
                    error_3 = _a.sent();
                    return [2 /*return*/, res.status(500).json({
                            error: 'Decision retrieval failed',
                            message: error_3 instanceof Error ? error_3.message : String(error_3),
                        })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    /**
     * GET /api/memory/agents/:agentId
     *
     * Retrieve agent-specific memory context.
     *
     * Path params:
     * - agentId: string - Agent identifier
     *
     * Query params:
     * - q: string (optional) - Search query
     * - Other params same as /api/memory/retrieve
     */
    app.get('/api/memory/agents/:agentId', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var agentId, query, options, retriever, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    agentId = req.params.agentId;
                    query = typeof req.query.q === 'string' ? req.query.q : '';
                    options = buildRetrieveOptions(req.query);
                    retriever = createRetriever();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, retriever.retrieveAgentContext(agentId, query, options)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, res.json(result)];
                case 3:
                    error_4 = _a.sent();
                    return [2 /*return*/, res.status(500).json({
                            error: 'Agent memory retrieval failed',
                            message: error_4 instanceof Error ? error_4.message : String(error_4),
                        })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    /**
     * GET /api/memory/project
     *
     * Retrieve general project context.
     *
     * Query params:
     * - q: string (optional) - Search query for filtering
     * - Other params same as /api/memory/retrieve
     */
    app.get('/api/memory/project', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var query, options, retriever, result, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = typeof req.query.q === 'string' ? req.query.q : '';
                    options = buildRetrieveOptions(req.query);
                    retriever = createRetriever();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, retriever.retrieveProjectContext(query, options)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, res.json(result)];
                case 3:
                    error_5 = _a.sent();
                    return [2 /*return*/, res.status(500).json({
                            error: 'Project context retrieval failed',
                            message: error_5 instanceof Error ? error_5.message : String(error_5),
                        })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    /**
     * GET /api/memory/knowledge
     *
     * Retrieve knowledge base entries.
     *
     * Query params:
     * - q: string (required) - Search query
     * - domain: string (optional) - Domain filter (e.g., "engineering", "design")
     * - Other params same as /api/memory/retrieve
     */
    app.get('/api/memory/knowledge', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var query, domain, options, retriever, result, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = typeof req.query.q === 'string' ? req.query.q : '';
                    domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
                    if (!query.trim()) {
                        return [2 /*return*/, res.status(400).json({
                                error: 'query parameter "q" is required',
                            })];
                    }
                    options = buildRetrieveOptions(req.query);
                    retriever = createRetriever();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, retriever.retrieveKnowledge(query, domain, options)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, res.json(result)];
                case 3:
                    error_6 = _a.sent();
                    return [2 /*return*/, res.status(500).json({
                            error: 'Knowledge retrieval failed',
                            message: error_6 instanceof Error ? error_6.message : String(error_6),
                        })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
}
