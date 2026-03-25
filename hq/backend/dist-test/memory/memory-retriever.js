"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveMemoryContext = retrieveMemoryContext;
exports.writeExecutionSummaryToMemory = writeExecutionSummaryToMemory;
exports.clearMemoryCache = clearMemoryCache;
exports.retrieveForTask = retrieveForTask;
exports.retrieveProjectContext = retrieveProjectContext;
exports.retrieveDecisions = retrieveDecisions;
exports.retrieveAgentContext = retrieveAgentContext;
exports.retrieveKnowledge = retrieveKnowledge;
var node_fs_1 = __importDefault(require("node:fs"));
var node_path_1 = __importDefault(require("node:path"));
var memory_indexer_1 = require("./memory-indexer");
function getTokenSet(text) {
    var tokens = text
        .toLowerCase()
        .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
        .filter(function (token) { return token.length >= 2; });
    return new Set(tokens);
}
function getTokenList(text) {
    return text
        .toLowerCase()
        .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
        .filter(function (token) { return token.length >= 2; });
}
function countQueryBigramsInContent(queryTokens, normalizedDocumentContent) {
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
}
function buildTermFrequency(tokens) {
    var map = new Map();
    for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
        var token = tokens_1[_i];
        map.set(token, (map.get(token) || 0) + 1);
    }
    return map;
}
function scoreDocument(document, queryTokens, orderedQueryTokens) {
    var documentTokens = getTokenSet(document.content);
    var termFrequency = buildTermFrequency(getTokenList(document.content));
    var normalizedContent = document.content.toLowerCase().replace(/\s+/g, ' ');
    var normalizedPath = document.relativePath.toLowerCase();
    var score = 0;
    var matchedUnique = 0;
    for (var _i = 0, queryTokens_1 = queryTokens; _i < queryTokens_1.length; _i++) {
        var token = queryTokens_1[_i];
        if (documentTokens.has(token)) {
            matchedUnique += 1;
            var tf = termFrequency.get(token) || 1;
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
    score += countQueryBigramsInContent(orderedQueryTokens, normalizedContent) * 1.8;
    return Number(score.toFixed(4));
}
function toExcerpt(content, maxLength) {
    if (maxLength === void 0) { maxLength = 300; }
    var compact = content.replace(/\s+/g, ' ').trim();
    if (compact.length <= maxLength) {
        return compact;
    }
    if (maxLength <= 3) {
        return '.'.repeat(Math.max(maxLength, 0));
    }
    return "".concat(compact.slice(0, maxLength - 3), "...");
}
function retrieveMemoryContext(query, options) {
    var _a;
    var memoryRootDir = options.memoryRootDir, _b = options.limit, limit = _b === void 0 ? 3 : _b, _c = options.excerptMaxChars, excerptMaxChars = _c === void 0 ? 300 : _c, _d = options.contextMaxChars, contextMaxChars = _d === void 0 ? 1600 : _d, _e = options.fallbackMode, fallbackMode = _e === void 0 ? 'recent' : _e, _f = options.useCache, useCache = _f === void 0 ? false : _f, documentTypes = options.documentTypes;
    if (useCache) {
        var cacheKey = "".concat(memoryRootDir, ":").concat(query, ":").concat(limit, ":").concat(excerptMaxChars, ":").concat(contextMaxChars, ":").concat((_a = documentTypes === null || documentTypes === void 0 ? void 0 : documentTypes.join(',')) !== null && _a !== void 0 ? _a : 'all');
        var cached = memoryCache.get(cacheKey);
        if (cached) {
            return cached;
        }
    }
    var queryTokens = getTokenSet(query);
    var orderedQueryTokens = getTokenList(query);
    if (!node_fs_1.default.existsSync(memoryRootDir)) {
        return {
            entries: [],
            context: '',
        };
    }
    var documents = (0, memory_indexer_1.indexMemoryDocuments)(memoryRootDir, { documentTypes: documentTypes });
    if (documents.length === 0) {
        return {
            entries: [],
            context: '',
        };
    }
    if (queryTokens.size === 0) {
        return {
            entries: [],
            context: '',
        };
    }
    var ranked = documents
        .map(function (document) { return ({
        document: document,
        score: scoreDocument(document, queryTokens, orderedQueryTokens),
    }); })
        .sort(function (left, right) {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return right.document.modifiedAtMs - left.document.modifiedAtMs;
    });
    var matched = ranked.filter(function (item) { return item.score > 0; }).slice(0, limit);
    var selected = matched.length > 0
        ? matched
        : fallbackMode === 'recent'
            ? documents
                .slice()
                .sort(function (left, right) { return right.modifiedAtMs - left.modifiedAtMs; })
                .slice(0, limit)
                .map(function (document) { return ({ document: document, score: 0 }); })
            : [];
    var baseEntries = selected.map(function (item) { return ({
        relativePath: item.document.relativePath,
        excerpt: toExcerpt(item.document.content, excerptMaxChars),
        score: item.score,
    }); });
    var entries = [];
    var contextSections = [];
    var usedChars = 0;
    for (var index = 0; index < baseEntries.length; index += 1) {
        var entry = baseEntries[index];
        var header = "#".concat(index + 1, " ").concat(entry.relativePath, "\n");
        var section = "".concat(header).concat(entry.excerpt);
        var separator = contextSections.length > 0 ? '\n\n' : '';
        var projectedLength = usedChars + separator.length + section.length;
        if (projectedLength <= contextMaxChars) {
            contextSections.push(section);
            entries.push(entry);
            usedChars = projectedLength;
            continue;
        }
        var remaining = contextMaxChars - usedChars - separator.length - header.length;
        if (remaining <= 16) {
            break;
        }
        var trimmedExcerpt = toExcerpt(entry.excerpt, remaining);
        var trimmedSection = "".concat(header).concat(trimmedExcerpt);
        contextSections.push(trimmedSection);
        entries.push(__assign(__assign({}, entry), { excerpt: trimmedExcerpt }));
        break;
    }
    var context = contextSections.join('\n\n');
    var result = { entries: entries, context: context };
    if (useCache) {
        var cacheKey = "".concat(memoryRootDir, ":").concat(query, ":").concat(limit, ":").concat(excerptMaxChars, ":").concat(contextMaxChars);
        memoryCache.set(cacheKey, result);
    }
    return result;
}
function writeExecutionSummaryToMemory(task, execution, options) {
    var _a;
    var now = (_a = options.now) !== null && _a !== void 0 ? _a : new Date();
    var datePart = now.toISOString().slice(0, 10);
    var taskDir = node_path_1.default.join(options.memoryRootDir, 'task-summaries');
    node_fs_1.default.mkdirSync(taskDir, { recursive: true });
    var fileName = "".concat(datePart, "-").concat(task.id, ".md");
    var filePath = node_path_1.default.join(taskDir, fileName);
    var lines = [
        "## Execution ".concat(execution.id),
        '',
        "- Time: ".concat(now.toISOString()),
        "- Task: ".concat(task.title),
        "- Task ID: ".concat(task.id),
        "- Mode: ".concat(task.executionMode),
        "- Executor: ".concat(execution.executor),
        "- Status: ".concat(execution.status),
        '',
        '### Task Description',
        task.description,
        '',
        '### Result Summary',
        execution.outputSummary || execution.errorMessage || 'No summary captured.',
        '',
    ];
    node_fs_1.default.appendFileSync(filePath, "".concat(lines.join('\n'), "\n"), 'utf8');
    return filePath;
}
var memoryCache = new Map();
function clearMemoryCache() {
    memoryCache.clear();
}
function retrieveForTask(taskId, query, options) {
    var memoryRootDir = options.memoryRootDir, _a = options.limit, limit = _a === void 0 ? 3 : _a, excerptMaxChars = options.excerptMaxChars, contextMaxChars = options.contextMaxChars, _b = options.useCache, useCache = _b === void 0 ? false : _b;
    if (!node_fs_1.default.existsSync(memoryRootDir)) {
        return { entries: [], context: '' };
    }
    var allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(memoryRootDir);
    var taskDocuments = allDocuments.filter(function (doc) {
        return doc.relativePath.includes(taskId) || doc.relativePath.startsWith('task-summaries');
    });
    if (taskDocuments.length === 0) {
        return retrieveMemoryContext(query, { memoryRootDir: memoryRootDir, limit: limit, excerptMaxChars: excerptMaxChars, contextMaxChars: contextMaxChars });
    }
    var queryTokens = getTokenSet(query);
    var orderedQueryTokens = getTokenList(query);
    var ranked = taskDocuments
        .map(function (document) { return ({
        document: document,
        score: scoreDocument(document, queryTokens, orderedQueryTokens),
    }); })
        .sort(function (left, right) {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return right.document.modifiedAtMs - left.document.modifiedAtMs;
    });
    var matched = ranked.filter(function (item) { return item.score > 0; }).slice(0, limit);
    var selected = matched.length > 0 ? matched : taskDocuments.slice(0, limit).map(function (document) { return ({ document: document, score: 0 }); });
    var baseEntries = selected.map(function (item) { return ({
        relativePath: item.document.relativePath,
        excerpt: toExcerpt(item.document.content, excerptMaxChars),
        score: item.score,
    }); });
    var entries = [];
    var contextSections = [];
    var usedChars = 0;
    var maxChars = contextMaxChars || 1600;
    for (var index = 0; index < baseEntries.length; index += 1) {
        var entry = baseEntries[index];
        var header = "#".concat(index + 1, " ").concat(entry.relativePath, "\n");
        var section = "".concat(header).concat(entry.excerpt);
        var separator = contextSections.length > 0 ? '\n\n' : '';
        var projectedLength = usedChars + separator.length + section.length;
        if (projectedLength <= maxChars) {
            contextSections.push(section);
            entries.push(entry);
            usedChars = projectedLength;
            continue;
        }
        var remaining = maxChars - usedChars - separator.length - header.length;
        if (remaining <= 16) {
            break;
        }
        var trimmedExcerpt = toExcerpt(entry.excerpt, remaining);
        var trimmedSection = "".concat(header).concat(trimmedExcerpt);
        contextSections.push(trimmedSection);
        entries.push(__assign(__assign({}, entry), { excerpt: trimmedExcerpt }));
        break;
    }
    var context = contextSections.join('\n\n');
    var result = { entries: entries, context: context };
    if (useCache) {
        var cacheKey = "".concat(memoryRootDir, ":").concat(query, ":").concat(limit, ":").concat(excerptMaxChars, ":").concat(contextMaxChars);
        memoryCache.set(cacheKey, result);
    }
    return result;
}
function retrieveProjectContext(options) {
    var memoryRootDir = options.memoryRootDir, _a = options.limit, limit = _a === void 0 ? 5 : _a;
    if (!node_fs_1.default.existsSync(memoryRootDir)) {
        return { entries: [], context: '' };
    }
    var documents = (0, memory_indexer_1.indexMemoryDocuments)(memoryRootDir);
    if (documents.length === 0) {
        return { entries: [], context: '' };
    }
    var sorted = documents.sort(function (a, b) { return b.modifiedAtMs - a.modifiedAtMs; }).slice(0, limit);
    var entries = sorted.map(function (doc) { return ({
        relativePath: doc.relativePath,
        excerpt: toExcerpt(doc.content, options.excerptMaxChars),
        score: 0,
    }); });
    var contextSections = entries.map(function (entry, index) { return "#".concat(index + 1, " ").concat(entry.relativePath, "\n").concat(entry.excerpt); });
    var context = contextSections.join('\n\n');
    var maxChars = options.contextMaxChars || 1600;
    if (context.length > maxChars) {
        context = context.slice(0, maxChars - 3) + '...';
    }
    return { entries: entries, context: context };
}
function retrieveDecisions(query, options) {
    var memoryRootDir = options.memoryRootDir, _a = options.limit, limit = _a === void 0 ? 3 : _a;
    if (!node_fs_1.default.existsSync(memoryRootDir)) {
        return { entries: [], context: '' };
    }
    var allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(memoryRootDir);
    var decisionDocuments = (0, memory_indexer_1.filterDocumentsByType)(allDocuments, 'decisions');
    if (decisionDocuments.length === 0) {
        return { entries: [], context: '' };
    }
    return retrieveMemoryContext(query, __assign(__assign({}, options), { memoryRootDir: memoryRootDir, limit: limit }));
}
function retrieveAgentContext(agentId, options) {
    var memoryRootDir = options.memoryRootDir, _a = options.limit, limit = _a === void 0 ? 3 : _a;
    if (!node_fs_1.default.existsSync(memoryRootDir)) {
        return { entries: [], context: '' };
    }
    var allDocuments = (0, memory_indexer_1.indexMemoryDocuments)(memoryRootDir);
    var agentDocuments = allDocuments.filter(function (doc) {
        return doc.relativePath.includes(agentId);
    });
    if (agentDocuments.length === 0) {
        return { entries: [], context: '' };
    }
    var entries = agentDocuments.slice(0, limit).map(function (doc) { return ({
        relativePath: doc.relativePath,
        excerpt: toExcerpt(doc.content, options.excerptMaxChars),
        score: 0,
    }); });
    var contextSections = entries.map(function (entry, index) { return "#".concat(index + 1, " ").concat(entry.relativePath, "\n").concat(entry.excerpt); });
    var context = contextSections.join('\n\n');
    var maxChars = options.contextMaxChars || 1600;
    if (context.length > maxChars) {
        context = context.slice(0, maxChars - 3) + '...';
    }
    return { entries: entries, context: context };
}
function retrieveKnowledge(query, options) {
    return retrieveMemoryContext(query, options);
}
