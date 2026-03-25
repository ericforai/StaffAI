"use strict";
/**
 * File Memory Retriever Implementation
 *
 * Provides memory retrieval functionality from the filesystem .ai/ directory.
 * Implements the MemoryRetriever interface with caching and type-weighted scoring.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMemoryRetriever = void 0;
exports.createMemoryRetriever = createMemoryRetriever;
var node_fs_1 = __importDefault(require("node:fs"));
var memory_indexer_1 = require("./memory-indexer");
var memory_retriever_types_1 = require("./memory-retriever-types");
/**
 * File-based implementation of MemoryRetriever
 */
var FileMemoryRetriever = /** @class */ (function () {
    function FileMemoryRetriever(config) {
        var _a, _b;
        this.cache = new Map();
        this.memoryRootDir = config.memoryRootDir;
        this.cacheTtlMs = (_a = config.cacheTtlMs) !== null && _a !== void 0 ? _a : 300000; // 5 minutes default
        this.enableCache = (_b = config.enableCache) !== null && _b !== void 0 ? _b : true;
    }
    /**
     * Retrieve memory context relevant to a specific task
     */
    FileMemoryRetriever.prototype.retrieveForTask = function (query, taskId, options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, cacheKey, cached, allDocuments, taskDocuments, result;
            return __generator(this, function (_a) {
                opts = this.normalizeOptions(options);
                cacheKey = this.buildCacheKey('task', taskId, query, opts);
                cached = this.getFromCache(cacheKey);
                if (cached) {
                    return [2 /*return*/, cached];
                }
                if (!node_fs_1.default.existsSync(this.memoryRootDir)) {
                    return [2 /*return*/, this.emptyResult(query)];
                }
                allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(this.memoryRootDir);
                taskDocuments = this.filterTaskDocuments(allDocuments, taskId);
                if (taskDocuments.length === 0) {
                    // Fall back to general retrieval if no task-specific documents
                    return [2 /*return*/, this.retrieveInternal(query, allDocuments, opts)];
                }
                result = this.retrieveInternal(query, taskDocuments, opts);
                this.setToCache(cacheKey, result);
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Retrieve general project context
     */
    FileMemoryRetriever.prototype.retrieveProjectContext = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, searchQuery, cacheKey, cached, documents, result;
            return __generator(this, function (_a) {
                opts = this.normalizeOptions(options);
                searchQuery = query !== null && query !== void 0 ? query : '';
                cacheKey = this.buildCacheKey('project', '', searchQuery, opts);
                cached = this.getFromCache(cacheKey);
                if (cached) {
                    return [2 /*return*/, cached];
                }
                if (!node_fs_1.default.existsSync(this.memoryRootDir)) {
                    return [2 /*return*/, this.emptyResult(searchQuery)];
                }
                documents = (0, memory_indexer_1.indexMemoryDocuments)(this.memoryRootDir);
                result = this.retrieveInternal(searchQuery, documents, opts);
                this.setToCache(cacheKey, result);
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Retrieve decision records matching a query
     */
    FileMemoryRetriever.prototype.retrieveDecisions = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, cacheKey, cached, allDocuments, decisionDocuments, result;
            return __generator(this, function (_a) {
                opts = this.normalizeOptions(options);
                cacheKey = this.buildCacheKey('decisions', '', query, opts);
                cached = this.getFromCache(cacheKey);
                if (cached) {
                    return [2 /*return*/, cached];
                }
                if (!node_fs_1.default.existsSync(this.memoryRootDir)) {
                    return [2 /*return*/, this.emptyResult(query)];
                }
                allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(this.memoryRootDir);
                decisionDocuments = (0, memory_indexer_1.filterDocumentsByType)(allDocuments, 'decisions');
                if (decisionDocuments.length === 0) {
                    return [2 /*return*/, this.emptyResult(query)];
                }
                result = this.retrieveInternal(query, decisionDocuments, opts);
                this.setToCache(cacheKey, result);
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Retrieve agent-specific memory context
     */
    FileMemoryRetriever.prototype.retrieveAgentContext = function (agentId, query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, searchQuery, cacheKey, cached, allDocuments, agentDocuments, result;
            return __generator(this, function (_a) {
                opts = this.normalizeOptions(options);
                searchQuery = query !== null && query !== void 0 ? query : '';
                cacheKey = this.buildCacheKey('agent', agentId, searchQuery, opts);
                cached = this.getFromCache(cacheKey);
                if (cached) {
                    return [2 /*return*/, cached];
                }
                if (!node_fs_1.default.existsSync(this.memoryRootDir)) {
                    return [2 /*return*/, this.emptyResult(searchQuery)];
                }
                allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(this.memoryRootDir);
                agentDocuments = allDocuments.filter(function (doc) {
                    return doc.relativePath.includes(agentId);
                });
                if (agentDocuments.length === 0) {
                    return [2 /*return*/, this.emptyResult(searchQuery)];
                }
                result = this.retrieveInternal(searchQuery, agentDocuments, opts);
                this.setToCache(cacheKey, result);
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Retrieve knowledge base entries
     */
    FileMemoryRetriever.prototype.retrieveKnowledge = function (query, domain, options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, domainSuffix, cacheKey, cached, allDocuments, knowledgeDocuments, result;
            return __generator(this, function (_a) {
                opts = this.normalizeOptions(options);
                domainSuffix = domain !== null && domain !== void 0 ? domain : '';
                cacheKey = this.buildCacheKey('knowledge', domainSuffix, query, opts);
                cached = this.getFromCache(cacheKey);
                if (cached) {
                    return [2 /*return*/, cached];
                }
                if (!node_fs_1.default.existsSync(this.memoryRootDir)) {
                    return [2 /*return*/, this.emptyResult(query)];
                }
                allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(this.memoryRootDir);
                knowledgeDocuments = this.filterKnowledgeDocuments(allDocuments, domain);
                result = this.retrieveInternal(query, knowledgeDocuments, opts);
                this.setToCache(cacheKey, result);
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * General retrieval across all memory types
     */
    FileMemoryRetriever.prototype.retrieve = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, cacheKey, cached, documents, result;
            return __generator(this, function (_a) {
                opts = this.normalizeOptions(options);
                cacheKey = this.buildCacheKey('general', '', query, opts);
                cached = this.getFromCache(cacheKey);
                if (cached) {
                    return [2 /*return*/, cached];
                }
                if (!node_fs_1.default.existsSync(this.memoryRootDir)) {
                    return [2 /*return*/, this.emptyResult(query)];
                }
                documents = (0, memory_indexer_1.indexMemoryDocuments)(this.memoryRootDir);
                result = this.retrieveInternal(query, documents, opts);
                this.setToCache(cacheKey, result);
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * Clear the internal cache
     */
    FileMemoryRetriever.prototype.clearCache = function () {
        this.cache.clear();
    };
    /**
     * Internal retrieval implementation
     */
    FileMemoryRetriever.prototype.retrieveInternal = function (query, documents, options) {
        var filtered = this.filterDocuments(documents, options);
        var scored = this.scoreDocuments(query, filtered);
        var sorted = this.sortAndLimit(scored, options);
        var entries = this.buildEntries(sorted, options);
        var context = this.buildContextString(entries, options);
        return {
            entries: entries,
            context: context,
            metadata: this.buildMetadata(query, documents.length, entries.length),
        };
    };
    /**
     * Normalize options with defaults
     */
    FileMemoryRetriever.prototype.normalizeOptions = function (options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            limit: (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 3,
            threshold: (_b = options === null || options === void 0 ? void 0 : options.threshold) !== null && _b !== void 0 ? _b : 0,
            includeFullContent: (_c = options === null || options === void 0 ? void 0 : options.includeFullContent) !== null && _c !== void 0 ? _c : false,
            documentTypes: (_d = options === null || options === void 0 ? void 0 : options.documentTypes) !== null && _d !== void 0 ? _d : [],
            timeRange: (_e = options === null || options === void 0 ? void 0 : options.timeRange) !== null && _e !== void 0 ? _e : { start: new Date(0), end: new Date() },
            excerptMaxChars: (_f = options === null || options === void 0 ? void 0 : options.excerptMaxChars) !== null && _f !== void 0 ? _f : 300,
            contextMaxChars: (_g = options === null || options === void 0 ? void 0 : options.contextMaxChars) !== null && _g !== void 0 ? _g : 1600,
            fallbackMode: (_h = options === null || options === void 0 ? void 0 : options.fallbackMode) !== null && _h !== void 0 ? _h : 'recent',
        };
    };
    /**
     * Build cache key from parameters
     */
    FileMemoryRetriever.prototype.buildCacheKey = function (type, scope, query, options) {
        var _a, _b, _c, _d, _e, _f;
        var parts = [
            type,
            scope,
            query,
            options.limit,
            options.threshold,
            options.includeFullContent,
            (_b = (_a = options.documentTypes) === null || _a === void 0 ? void 0 : _a.join(',')) !== null && _b !== void 0 ? _b : '',
            (_d = (_c = options.timeRange) === null || _c === void 0 ? void 0 : _c.start.getTime()) !== null && _d !== void 0 ? _d : '',
            (_f = (_e = options.timeRange) === null || _e === void 0 ? void 0 : _e.end.getTime()) !== null && _f !== void 0 ? _f : '',
            options.excerptMaxChars,
            options.contextMaxChars,
            options.fallbackMode,
        ];
        return parts.join(':');
    };
    /**
     * Get cached result if not expired
     */
    FileMemoryRetriever.prototype.getFromCache = function (key) {
        if (!this.enableCache) {
            return null;
        }
        var entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.result;
    };
    /**
     * Set result in cache with expiration
     */
    FileMemoryRetriever.prototype.setToCache = function (key, result) {
        if (!this.enableCache) {
            return;
        }
        this.cache.set(key, {
            result: result,
            expiresAt: Date.now() + this.cacheTtlMs,
        });
    };
    /**
     * Filter documents by options
     */
    FileMemoryRetriever.prototype.filterDocuments = function (documents, options) {
        var _this = this;
        var filtered = documents;
        // Filter by document type
        if (options.documentTypes && options.documentTypes.length > 0) {
            filtered = filtered.filter(function (doc) {
                var docType = _this.inferDocumentType(doc.relativePath);
                return options.documentTypes.includes(docType);
            });
        }
        // Filter by time range
        if (options.timeRange) {
            var startMs = options.timeRange.start.getTime();
            var endMs = options.timeRange.end.getTime();
            filtered = (0, memory_indexer_1.filterDocumentsByDateRange)(filtered, startMs, endMs);
        }
        return filtered;
    };
    /**
     * Filter documents for a specific task
     */
    FileMemoryRetriever.prototype.filterTaskDocuments = function (documents, taskId) {
        return documents.filter(function (doc) {
            return doc.relativePath.includes(taskId) || doc.relativePath.startsWith('tasks/');
        });
    };
    /**
     * Filter knowledge documents by domain
     */
    FileMemoryRetriever.prototype.filterKnowledgeDocuments = function (documents, domain) {
        var filtered = documents.filter(function (doc) {
            return doc.relativePath.startsWith('knowledge/') || doc.relativePath.includes('/knowledge/');
        });
        if (domain) {
            filtered = filtered.filter(function (doc) {
                return doc.relativePath.toLowerCase().includes(domain.toLowerCase());
            });
        }
        return filtered;
    };
    /**
     * Score documents by query relevance
     */
    FileMemoryRetriever.prototype.scoreDocuments = function (query, documents) {
        var _this = this;
        if (query.trim().length === 0) {
            // No query: return all with zero score
            return documents.map(function (document) { return ({ document: document, score: 0 }); });
        }
        var queryTokens = this.getTokenSet(query);
        var orderedQueryTokens = this.getTokenList(query);
        return documents.map(function (document) {
            var _a;
            var baseScore = _this.scoreDocument(document, queryTokens, orderedQueryTokens);
            var typeWeight = (_a = memory_retriever_types_1.MEMORY_TYPE_WEIGHTS[_this.inferDocumentType(document.relativePath)]) !== null && _a !== void 0 ? _a : 1.0;
            return {
                document: document,
                score: baseScore * typeWeight,
            };
        });
    };
    /**
     * Score a single document against query tokens
     */
    FileMemoryRetriever.prototype.scoreDocument = function (document, queryTokens, orderedQueryTokens) {
        var _a;
        var documentTokens = this.getTokenSet(document.content);
        var termFrequency = this.buildTermFrequency(this.getTokenList(document.content));
        var normalizedContent = document.content.toLowerCase().replace(/\s+/g, ' ');
        var normalizedPath = document.relativePath.toLowerCase();
        var score = 0;
        var matchedUnique = 0;
        for (var _i = 0, queryTokens_1 = queryTokens; _i < queryTokens_1.length; _i++) {
            var token = queryTokens_1[_i];
            if (documentTokens.has(token)) {
                matchedUnique += 1;
                var tf = (_a = termFrequency.get(token)) !== null && _a !== void 0 ? _a : 1;
                score += 2 + Math.log2(1 + tf);
                if (normalizedPath.includes(token)) {
                    score += 1.25;
                }
            }
        }
        if (queryTokens.size > 0) {
            var coverage = matchedUnique / queryTokens.size;
            score += coverage * 5;
        }
        score += this.countQueryBigramsInContent(orderedQueryTokens, normalizedContent) * 1.8;
        return Number(score.toFixed(4));
    };
    /**
     * Sort and limit results
     */
    FileMemoryRetriever.prototype.sortAndLimit = function (scored, options) {
        var threshold = options.threshold;
        // Sort by score descending, then by date descending
        var sorted = scored.sort(function (left, right) {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            return right.document.modifiedAtMs - left.document.modifiedAtMs;
        });
        // Filter by threshold
        var aboveThreshold = sorted.filter(function (item) { return item.score >= threshold; });
        // If no matches and fallback mode is 'recent', return recent documents
        if (aboveThreshold.length === 0 && options.fallbackMode === 'recent') {
            return sorted.slice(0, options.limit);
        }
        return aboveThreshold.slice(0, options.limit);
    };
    /**
     * Build MemoryContext entries
     */
    FileMemoryRetriever.prototype.buildEntries = function (scored, options) {
        var _this = this;
        return scored.map(function (item) { return ({
            relativePath: item.document.relativePath,
            type: _this.inferDocumentType(item.document.relativePath),
            excerpt: _this.toExcerpt(item.document.content, options.excerptMaxChars),
            fullContent: options.includeFullContent ? item.document.content : undefined,
            score: item.score,
            modifiedAtMs: item.document.modifiedAtMs,
        }); });
    };
    /**
     * Build formatted context string
     */
    FileMemoryRetriever.prototype.buildContextString = function (entries, options) {
        var sections = [];
        var usedChars = 0;
        for (var index = 0; index < entries.length; index += 1) {
            var entry = entries[index];
            var header = "#".concat(index + 1, " ").concat(entry.relativePath, "\n");
            var section = "".concat(header).concat(entry.excerpt);
            var separator = sections.length > 0 ? '\n\n' : '';
            var projectedLength = usedChars + separator.length + section.length;
            if (projectedLength <= options.contextMaxChars) {
                sections.push(section);
                usedChars = projectedLength;
                continue;
            }
            var remaining = options.contextMaxChars - usedChars - separator.length - header.length;
            if (remaining <= 16) {
                break;
            }
            var trimmedExcerpt = this.toExcerpt(entry.excerpt, remaining);
            var trimmedSection = "".concat(header).concat(trimmedExcerpt);
            sections.push(trimmedSection);
            break;
        }
        return sections.join('\n\n');
    };
    /**
     * Build metadata object
     */
    FileMemoryRetriever.prototype.buildMetadata = function (query, totalDocuments, matchedDocuments) {
        return {
            query: query,
            totalDocuments: totalDocuments,
            matchedDocuments: matchedDocuments,
            types: {
                project: 0,
                task: 0,
                decision: 0,
                knowledge: 0,
                agent: 0,
            },
        };
    };
    /**
     * Infer document type from relative path
     */
    FileMemoryRetriever.prototype.inferDocumentType = function (relativePath) {
        var normalized = relativePath.toLowerCase();
        if (normalized.startsWith('context/') || normalized.includes('/context/')) {
            return 'project';
        }
        if (normalized.startsWith('tasks/') || normalized.includes('/tasks/') || normalized.startsWith('task-summaries')) {
            return 'task';
        }
        if (normalized.startsWith('decisions/') || normalized.includes('/decisions/')) {
            return 'decision';
        }
        if (normalized.startsWith('knowledge/') || normalized.includes('/knowledge/')) {
            return 'knowledge';
        }
        if (normalized.startsWith('agents/') || normalized.includes('/agents/')) {
            return 'agent';
        }
        return 'project'; // Default
    };
    /**
     * Create empty result
     */
    FileMemoryRetriever.prototype.emptyResult = function (query) {
        return {
            entries: [],
            context: '',
            metadata: {
                query: query,
                totalDocuments: 0,
                matchedDocuments: 0,
                types: {
                    project: 0,
                    task: 0,
                    decision: 0,
                    knowledge: 0,
                    agent: 0,
                },
            },
        };
    };
    /**
     * Tokenization utilities
     */
    FileMemoryRetriever.prototype.getTokenSet = function (text) {
        var tokens = text
            .toLowerCase()
            .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
            .filter(function (token) { return token.length >= 2; });
        return new Set(tokens);
    };
    FileMemoryRetriever.prototype.getTokenList = function (text) {
        return text
            .toLowerCase()
            .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
            .filter(function (token) { return token.length >= 2; });
    };
    FileMemoryRetriever.prototype.buildTermFrequency = function (tokens) {
        var _a;
        var map = new Map();
        for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
            var token = tokens_1[_i];
            map.set(token, ((_a = map.get(token)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        return map;
    };
    FileMemoryRetriever.prototype.countQueryBigramsInContent = function (queryTokens, normalizedDocumentContent) {
        if (queryTokens.length < 2) {
            return 0;
        }
        var count = 0;
        for (var index = 0; index < queryTokens.length - 1; index += 1) {
            var bigram = "".concat(queryTokens[index], " ").concat(queryTokens[index + 1]);
            if (normalizedDocumentContent.includes(bigram)) {
                count += 1;
            }
        }
        return count;
    };
    FileMemoryRetriever.prototype.toExcerpt = function (content, maxLength) {
        if (maxLength === void 0) { maxLength = 300; }
        var compact = content.replace(/\s+/g, ' ').trim();
        if (compact.length <= maxLength) {
            return compact;
        }
        if (maxLength <= 3) {
            return '.'.repeat(Math.max(maxLength, 0));
        }
        return "".concat(compact.slice(0, maxLength - 3), "...");
    };
    return FileMemoryRetriever;
}());
exports.FileMemoryRetriever = FileMemoryRetriever;
/**
 * Factory function to create a FileMemoryRetriever
 */
function createMemoryRetriever(config) {
    return new FileMemoryRetriever(config);
}
