"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexMemoryDocuments = indexMemoryDocuments;
exports.categorizeDocument = categorizeDocument;
exports.filterDocumentsByType = filterDocumentsByType;
exports.filterDocumentsByDateRange = filterDocumentsByDateRange;
exports.deduplicateDocuments = deduplicateDocuments;
var node_fs_1 = __importDefault(require("node:fs"));
var node_path_1 = __importDefault(require("node:path"));
var node_crypto_1 = __importDefault(require("node:crypto"));
var memory_layout_1 = require("./memory-layout");
function walkMarkdownFiles(rootDir, baseDir, output) {
    if (!node_fs_1.default.existsSync(rootDir)) {
        return;
    }
    var entries = node_fs_1.default.readdirSync(rootDir, { withFileTypes: true });
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        var absolutePath = node_path_1.default.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            walkMarkdownFiles(absolutePath, baseDir, output);
            continue;
        }
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
            continue;
        }
        output.push(node_path_1.default.relative(baseDir, absolutePath));
    }
}
function indexMemoryDocuments(memoryRootDir, options) {
    var files = [];
    walkMarkdownFiles(memoryRootDir, memoryRootDir, files);
    var documents = files.map(function (relativePath) {
        var _a;
        var absolutePath = node_path_1.default.join(memoryRootDir, relativePath);
        var stat = node_fs_1.default.statSync(absolutePath);
        return {
            path: absolutePath,
            relativePath: relativePath,
            content: node_fs_1.default.readFileSync(absolutePath, 'utf8'),
            modifiedAtMs: stat.mtimeMs,
            documentType: (_a = (0, memory_layout_1.inferDocumentType)(relativePath)) !== null && _a !== void 0 ? _a : undefined,
        };
    });
    var result = documents.sort(function (a, b) { return b.modifiedAtMs - a.modifiedAtMs; });
    // Apply document type filtering if specified
    if ((options === null || options === void 0 ? void 0 : options.documentTypes) && options.documentTypes.length > 0) {
        result = result.filter(function (doc) {
            return doc.documentType !== undefined && options.documentTypes.includes(doc.documentType);
        });
    }
    return result;
}
function categorizeDocument(relativePath) {
    var normalizedPath = relativePath.toLowerCase();
    if (normalizedPath.startsWith('notes') || normalizedPath.includes('/notes/')) {
        return 'notes';
    }
    if (normalizedPath.startsWith('decisions') || normalizedPath.includes('/decisions/')) {
        return 'decisions';
    }
    if (normalizedPath.startsWith('playbooks') || normalizedPath.includes('/playbooks/')) {
        return 'playbooks';
    }
    if (normalizedPath.startsWith('agents') || normalizedPath.includes('/agents/')) {
        return 'agents';
    }
    if (normalizedPath.startsWith('meetings') || normalizedPath.includes('/meetings/')) {
        return 'meetings';
    }
    if (normalizedPath.startsWith('task-summaries') ||
        normalizedPath.includes('/task-summaries/')) {
        return 'tasks';
    }
    return 'other';
}
function filterDocumentsByType(documents, category) {
    if (documents.length === 0) {
        return [];
    }
    return documents.filter(function (doc) { return categorizeDocument(doc.relativePath) === category; });
}
function filterDocumentsByDateRange(documents, fromMs, toMs) {
    if (documents.length === 0) {
        return [];
    }
    return documents.filter(function (doc) {
        if (fromMs !== undefined && doc.modifiedAtMs < fromMs) {
            return false;
        }
        if (toMs !== undefined && doc.modifiedAtMs > toMs) {
            return false;
        }
        return true;
    });
}
function computeContentHash(content) {
    return node_crypto_1.default.createHash('sha256').update(content).digest('hex');
}
function deduplicateDocuments(documents) {
    if (documents.length === 0) {
        return [];
    }
    var hashToDocuments = new Map();
    for (var _i = 0, documents_1 = documents; _i < documents_1.length; _i++) {
        var doc = documents_1[_i];
        var hash = computeContentHash(doc.content);
        var existing = hashToDocuments.get(hash);
        if (!existing || doc.modifiedAtMs > existing.modifiedAtMs) {
            hashToDocuments.set(hash, doc);
        }
    }
    return Array.from(hashToDocuments.values());
}
