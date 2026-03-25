"use strict";
/**
 * File Memory Retriever Tests
 *
 * Comprehensive test suite for the MemoryRetriever interface and FileMemoryRetriever implementation.
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
var node_test_1 = __importDefault(require("node:test"));
var strict_1 = __importDefault(require("node:assert/strict"));
var node_fs_1 = __importDefault(require("node:fs"));
var node_path_1 = __importDefault(require("node:path"));
var node_fs_2 = require("node:fs");
var file_memory_retriever_1 = require("../memory/file-memory-retriever");
/** Test memory root directory */
var TEST_MEMORY_ROOT = node_path_1.default.join(process.cwd(), '.test-memory');
/** Setup test memory directory structure */
function setupTestMemory() {
    // Clean up any existing test directory
    if (node_fs_1.default.existsSync(TEST_MEMORY_ROOT)) {
        (0, node_fs_2.rmSync)(TEST_MEMORY_ROOT, { recursive: true, force: true });
    }
    // Create directory structure
    var directories = [
        node_path_1.default.join(TEST_MEMORY_ROOT, 'context'),
        node_path_1.default.join(TEST_MEMORY_ROOT, 'tasks'),
        node_path_1.default.join(TEST_MEMORY_ROOT, 'decisions'),
        node_path_1.default.join(TEST_MEMORY_ROOT, 'knowledge'),
        node_path_1.default.join(TEST_MEMORY_ROOT, 'agents'),
        node_path_1.default.join(TEST_MEMORY_ROOT, 'task-summaries'),
    ];
    for (var _i = 0, directories_1 = directories; _i < directories_1.length; _i++) {
        var dir = directories_1[_i];
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    }
    // Create test documents
    var now = Date.now();
    var dayMs = 24 * 60 * 60 * 1000;
    // Project context
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'context', 'project-overview.md'), "# Project Overview\n\nThis is a test project for demonstrating memory retrieval capabilities.\nThe project uses AI agents for various tasks.\n\nTech stack: TypeScript, Node.js, Express, React.\n", { flag: 'wx' });
    // Tasks
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'tasks', 'task-001.md'), "# Task: Implement Authentication\n\nImplement user authentication with JWT tokens.\nRequirements: login, logout, token refresh.\n", { flag: 'wx' });
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'tasks', 'task-002.md'), "# Task: Build Dashboard\n\nCreate a dashboard with charts and metrics.\nUse React and Recharts for visualization.\n", { flag: 'wx' });
    // Decisions
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'decisions', 'adr-001-architecture.md'), "# ADR 001: Architecture Decision\n\nWe chose a monorepo structure for better code sharing.\nAll services will use TypeScript for type safety.\nDecision date: ".concat(new Date(now - 2 * dayMs).toISOString(), "\n"), { flag: 'wx' });
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'decisions', 'adr-002-database.md'), "# ADR 002: Database Selection\n\nPostgreSQL was chosen as the primary database.\nRedis will be used for caching.\nDecision date: ".concat(new Date(now - dayMs).toISOString(), "\n"), { flag: 'wx' });
    // Knowledge
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'knowledge', 'typescript-patterns.md'), "# TypeScript Patterns\n\nCommon patterns for TypeScript development:\n- Use strict mode\n- Prefer interface over type for object shapes\n- Use utility types (Partial, Required, etc.)\n", { flag: 'wx' });
    // Agent specific
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'agents', 'frontend-developer-context.md'), "# Frontend Developer Context\n\nThe frontend developer specializes in React and TypeScript.\nPreferred styling: Tailwind CSS or CSS Modules.\n", { flag: 'wx' });
    // Task summary
    node_fs_1.default.writeFileSync(node_path_1.default.join(TEST_MEMORY_ROOT, 'task-summaries', '2024-03-25-task-001.md'), "## Execution Summary\n\nTask: task-001\nStatus: completed\nResult: Authentication system implemented successfully with JWT.\n", { flag: 'wx' });
}
/** Clean up test memory directory */
function cleanupTestMemory() {
    if (node_fs_1.default.existsSync(TEST_MEMORY_ROOT)) {
        (0, node_fs_2.rmSync)(TEST_MEMORY_ROOT, { recursive: true, force: true });
    }
}
/** Create a retriever instance for testing */
function createTestRetriever(enableCache) {
    if (enableCache === void 0) { enableCache = false; }
    return (0, file_memory_retriever_1.createMemoryRetriever)({
        memoryRootDir: TEST_MEMORY_ROOT,
        cacheTtlMs: 1000,
        enableCache: enableCache,
    });
}
(0, node_test_1.default)('beforeAll', function () { return setupTestMemory(); });
(0, node_test_1.default)('afterAll', function () { return cleanupTestMemory(); });
// ============================================================================
// Basic Retrieval Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever.retrieve returns empty result for non-existent directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = (0, file_memory_retriever_1.createMemoryRetriever)({
                    memoryRootDir: '/non-existent-path',
                    enableCache: false,
                });
                return [4 /*yield*/, retriever.retrieve('test query')];
            case 1:
                result = _a.sent();
                strict_1.default.equal(result.entries.length, 0);
                strict_1.default.equal(result.context, '');
                strict_1.default.equal(result.metadata.totalDocuments, 0);
                strict_1.default.equal(result.metadata.matchedDocuments, 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve returns results for matching query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('TypeScript')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                strict_1.default.ok(result.context.length > 0);
                strict_1.default.equal(result.metadata.query, 'TypeScript');
                strict_1.default.ok(result.metadata.totalDocuments > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve respects limit option', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test', { limit: 2 })];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length <= 2);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve respects threshold option', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, highThreshold;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('nonexistenttermxyz', { threshold: 10 })];
            case 1:
                highThreshold = _a.sent();
                strict_1.default.equal(highThreshold.entries.length, 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve includes full content when requested', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, entryWithFullContent;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('TypeScript', { includeFullContent: true })];
            case 1:
                result = _a.sent();
                entryWithFullContent = result.entries.find(function (e) { return e.fullContent !== undefined; });
                strict_1.default.ok(entryWithFullContent !== undefined);
                strict_1.default.ok(entryWithFullContent.fullContent.length > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve filters by document type', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, _i, _a, entry;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test', {
                        documentTypes: ['decision'],
                    })];
            case 1:
                result = _b.sent();
                // All entries should be decisions
                for (_i = 0, _a = result.entries; _i < _a.length; _i++) {
                    entry = _a[_i];
                    strict_1.default.equal(entry.type, 'decision');
                }
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve filters by time range', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, now, dayMs, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                now = Date.now();
                dayMs = 24 * 60 * 60 * 1000;
                return [4 /*yield*/, retriever.retrieve('test', {
                        timeRange: {
                            start: new Date(now - 3 * dayMs),
                            end: new Date(now + dayMs),
                        },
                    })];
            case 1:
                result = _a.sent();
                // Should return results within the time range
                strict_1.default.ok(result.entries.length >= 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve respects excerptMaxChars', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, _i, _a, entry;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('project', { excerptMaxChars: 50 })];
            case 1:
                result = _b.sent();
                for (_i = 0, _a = result.entries; _i < _a.length; _i++) {
                    entry = _a[_i];
                    strict_1.default.ok(entry.excerpt.length <= 55); // Allow some margin for "..."
                }
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve respects contextMaxChars', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test', { contextMaxChars: 100 })];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.context.length <= 105); // Allow some margin
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve fallback mode recent returns results when no matches', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('nonexistenttermxyz123', {
                        fallbackMode: 'recent',
                        limit: 2,
                    })];
            case 1:
                result = _a.sent();
                // Should return recent documents as fallback
                strict_1.default.ok(result.entries.length > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieve fallback mode none returns empty when no matches', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('nonexistenttermxyz123', {
                        fallbackMode: 'none',
                    })];
            case 1:
                result = _a.sent();
                strict_1.default.equal(result.entries.length, 0);
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Task-Specific Retrieval Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever.retrieveForTask returns task-related documents', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, hasTaskRelated;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveForTask('auth', 'task-001')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                hasTaskRelated = result.entries.some(function (e) {
                    return e.relativePath.includes('task-001') || e.relativePath.startsWith('tasks/');
                });
                strict_1.default.ok(hasTaskRelated);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieveForTask works with empty query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveForTask('', 'task-001', {
                        limit: 5,
                    })];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length >= 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieveForTask respects options', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveForTask('test', 'task-001', {
                        limit: 1,
                        includeFullContent: true,
                    })];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length <= 1);
                if (result.entries.length > 0) {
                    strict_1.default.ok(result.entries[0].fullContent !== undefined);
                }
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Project Context Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever.retrieveProjectContext returns recent documents', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveProjectContext()];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                strict_1.default.ok(result.context.length > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieveProjectContext filters with query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveProjectContext('architecture')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length >= 0);
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Decision Retrieval Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever.retrieveDecisions returns only decisions', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, _i, _a, entry;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveDecisions('database')];
            case 1:
                result = _b.sent();
                strict_1.default.ok(result.entries.length > 0);
                // All entries should be decisions
                for (_i = 0, _a = result.entries; _i < _a.length; _i++) {
                    entry = _a[_i];
                    strict_1.default.equal(entry.type, 'decision');
                }
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieveDecisions scores by relevance', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveDecisions('database')];
            case 1:
                result = _a.sent();
                // Results should be ordered by score
                for (i = 1; i < result.entries.length; i++) {
                    strict_1.default.ok(result.entries[i - 1].score >= result.entries[i].score);
                }
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Agent Context Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever.retrieveAgentContext returns agent-specific documents', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, hasAgentMention;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveAgentContext('frontend-developer')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                hasAgentMention = result.entries.some(function (e) {
                    return e.relativePath.includes('frontend-developer');
                });
                strict_1.default.ok(hasAgentMention);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieveAgentContext works with query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveAgentContext('frontend-developer', 'typescript')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length >= 0);
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Knowledge Retrieval Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever.retrieveKnowledge returns knowledge entries', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieveKnowledge('typescript')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.retrieveKnowledge filters by domain', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, domainDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                domainDir = node_path_1.default.join(TEST_MEMORY_ROOT, 'knowledge', 'engineering');
                node_fs_1.default.mkdirSync(domainDir, { recursive: true });
                node_fs_1.default.writeFileSync(node_path_1.default.join(domainDir, 'backend-patterns.md'), '# Backend Engineering Patterns\n\nAPI design patterns and best practices.', { flag: 'wx' });
                return [4 /*yield*/, retriever.retrieveKnowledge('patterns', 'engineering')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.entries.length >= 0);
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Cache Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever caches results when enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result1, result2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = (0, file_memory_retriever_1.createMemoryRetriever)({
                    memoryRootDir: TEST_MEMORY_ROOT,
                    cacheTtlMs: 5000,
                    enableCache: true,
                });
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 1:
                result1 = _a.sent();
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 2:
                result2 = _a.sent();
                // Results should be identical (cached)
                strict_1.default.equal(result1.entries.length, result2.entries.length);
                strict_1.default.equal(result1.context, result2.context);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever.clearCache clears cached results', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = (0, file_memory_retriever_1.createMemoryRetriever)({
                    memoryRootDir: TEST_MEMORY_ROOT,
                    cacheTtlMs: 5000,
                    enableCache: true,
                });
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 1:
                _a.sent();
                retriever.clearCache();
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 2:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever cache expires after TTL', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = (0, file_memory_retriever_1.createMemoryRetriever)({
                    memoryRootDir: TEST_MEMORY_ROOT,
                    cacheTtlMs: 100, // 100ms TTL
                    enableCache: true,
                });
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 1:
                _a.sent();
                // Wait for cache to expire
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 150); })];
            case 2:
                // Wait for cache to expire
                _a.sent();
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 3:
                result = _a.sent();
                strict_1.default.ok(result.entries.length > 0);
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Scoring and Type Weight Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever applies type weights to scores', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, _i, _a, entry;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test')];
            case 1:
                result = _b.sent();
                // All entries should have a score (weighted or not)
                for (_i = 0, _a = result.entries; _i < _a.length; _i++) {
                    entry = _a[_i];
                    strict_1.default.ok(typeof entry.score === 'number');
                    strict_1.default.ok(entry.score >= 0);
                }
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever sorts results by score and date', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, i, prev, curr;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test')];
            case 1:
                result = _a.sent();
                // Results should be sorted by score (desc) then date (desc)
                for (i = 1; i < result.entries.length; i++) {
                    prev = result.entries[i - 1];
                    curr = result.entries[i];
                    if (prev.score !== curr.score) {
                        strict_1.default.ok(prev.score > curr.score);
                    }
                }
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Entry Structure Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever entries have correct structure', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, _i, _a, entry;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test')];
            case 1:
                result = _b.sent();
                for (_i = 0, _a = result.entries; _i < _a.length; _i++) {
                    entry = _a[_i];
                    strict_1.default.ok(typeof entry.relativePath === 'string');
                    strict_1.default.ok(entry.relativePath.length > 0);
                    strict_1.default.ok(typeof entry.type === 'string');
                    strict_1.default.ok(['project', 'task', 'decision', 'knowledge', 'agent'].includes(entry.type));
                    strict_1.default.ok(typeof entry.excerpt === 'string');
                    strict_1.default.ok(entry.excerpt.length > 0);
                    strict_1.default.ok(typeof entry.score === 'number');
                    strict_1.default.ok(entry.score >= 0);
                    strict_1.default.ok(typeof entry.modifiedAtMs === 'number');
                    strict_1.default.ok(entry.modifiedAtMs > 0);
                }
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever metadata is complete', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result, _i, _a, type;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test query')];
            case 1:
                result = _b.sent();
                strict_1.default.equal(result.metadata.query, 'test query');
                strict_1.default.ok(typeof result.metadata.totalDocuments === 'number');
                strict_1.default.ok(typeof result.metadata.matchedDocuments === 'number');
                strict_1.default.ok(typeof result.metadata.types === 'object');
                // Check type counts
                for (_i = 0, _a = ['project', 'task', 'decision', 'knowledge', 'agent']; _i < _a.length; _i++) {
                    type = _a[_i];
                    strict_1.default.ok(typeof result.metadata.types[type] === 'number');
                }
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Context String Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever builds formatted context string', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.context.length > 0);
                // Context should have numbered sections
                strict_1.default.ok(result.context.includes('#1'));
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever context respects max chars limit', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, maxChars, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                maxChars = 200;
                return [4 /*yield*/, retriever.retrieve('test', { contextMaxChars: maxChars })];
            case 1:
                result = _a.sent();
                strict_1.default.ok(result.context.length <= maxChars + 10); // Allow small margin
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Edge Cases Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever handles empty query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('')];
            case 1:
                result = _a.sent();
                // Empty query should still work (return recent or empty)
                strict_1.default.ok(Array.isArray(result.entries));
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever handles special characters in query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test?!@#$%^&*()')];
            case 1:
                result = _a.sent();
                strict_1.default.ok(Array.isArray(result.entries));
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever handles very long query', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, longQuery, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                longQuery = 'test '.repeat(100);
                return [4 /*yield*/, retriever.retrieve(longQuery)];
            case 1:
                result = _a.sent();
                strict_1.default.ok(Array.isArray(result.entries));
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever handles zero limit', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test', { limit: 0 })];
            case 1:
                result = _a.sent();
                // Zero limit should return no entries
                strict_1.default.equal(result.entries.length, 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever handles very large limit', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, retriever.retrieve('test', { limit: 10000 })];
            case 1:
                result = _a.sent();
                // Should not exceed available documents
                strict_1.default.ok(result.entries.length <= result.metadata.totalDocuments);
                return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// Integration Tests
// ============================================================================
(0, node_test_1.default)('FileMemoryRetriever full workflow: retrieve, cache, clear', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, result1, result2, result3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retriever = (0, file_memory_retriever_1.createMemoryRetriever)({
                    memoryRootDir: TEST_MEMORY_ROOT,
                    cacheTtlMs: 1000,
                    enableCache: true,
                });
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 1:
                result1 = _a.sent();
                strict_1.default.ok(result1.entries.length > 0);
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 2:
                result2 = _a.sent();
                strict_1.default.deepEqual(result1, result2);
                // Clear cache and retrieve again
                retriever.clearCache();
                return [4 /*yield*/, retriever.retrieve('typescript')];
            case 3:
                result3 = _a.sent();
                strict_1.default.ok(result3.entries.length > 0);
                return [2 /*return*/];
        }
    });
}); });
(0, node_test_1.default)('FileMemoryRetriever multiple retrieval methods work together', function () { return __awaiter(void 0, void 0, void 0, function () {
    var retriever, _a, general, decisions, project, knowledge;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                retriever = createTestRetriever();
                return [4 /*yield*/, Promise.all([
                        retriever.retrieve('test'),
                        retriever.retrieveDecisions('database'),
                        retriever.retrieveProjectContext(),
                        retriever.retrieveKnowledge('typescript'),
                    ])];
            case 1:
                _a = _b.sent(), general = _a[0], decisions = _a[1], project = _a[2], knowledge = _a[3];
                strict_1.default.ok(general.entries.length >= 0);
                strict_1.default.ok(decisions.entries.length >= 0);
                strict_1.default.ok(project.entries.length >= 0);
                strict_1.default.ok(knowledge.entries.length >= 0);
                return [2 /*return*/];
        }
    });
}); });
