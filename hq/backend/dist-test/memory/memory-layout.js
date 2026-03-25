"use strict";
/**
 * Memory Directory Layout
 *
 * Defines the structure and types for the .ai/ memory directory.
 * This provides type-safe constants and helpers for working with the
 * standardized memory layout.
 *
 * @module memory/memory-layout
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORY_FILE_NAMES = exports.MEMORY_SUBDIRS = exports.CURRENT_TASK_TEMPLATE = exports.PROJECT_TEMPLATE = exports.MEMORY_DOCUMENT_TYPES = void 0;
exports.createMemoryLayout = createMemoryLayout;
exports.inferDocumentType = inferDocumentType;
exports.formatTemplate = formatTemplate;
exports.isValidDocumentType = isValidDocumentType;
exports.getSubdirectoryForType = getSubdirectoryForType;
var node_path_1 = __importDefault(require("node:path"));
/**
 * Supported document types in the memory system.
 * These correspond to subdirectories within the .ai/ directory.
 */
exports.MEMORY_DOCUMENT_TYPES = [
    'PROJECT',
    'TASK',
    'DECISION',
    'KNOWLEDGE',
    'AGENT',
    'SHARED',
];
/**
 * Template content for project.md in the context directory.
 */
exports.PROJECT_TEMPLATE = "# Project Context\n\n> Last updated: {{date}}\n\n## Project Overview\n<!-- Brief description of the project -->\n\n## Tech Stack\n<!-- Key technologies and frameworks -->\n\n## Architecture\n<!-- High-level architecture notes -->\n\n## Current Status\n<!-- What's currently being worked on -->\n\n## Key Decisions\n<!-- Link to important decisions in /decisions -->\n\n## Known Issues\n<!-- Track ongoing issues or blockers -->\n";
/**
 * Template content for current-task.md in the context directory.
 */
exports.CURRENT_TASK_TEMPLATE = "# Current Task\n\n> Started: {{date}}\n\n## Task Description\n<!-- What you're working on right now -->\n\n## Goal\n<!-- What success looks like -->\n\n## Progress\n<!-- Current status and next steps -->\n\n## blockers\n<!-- Anything preventing progress -->\n\n## Related\n<!-- Links to related docs, tasks, or decisions -->\n";
/**
 * Standard subdirectories that should exist in the .ai/ directory.
 */
exports.MEMORY_SUBDIRS = [
    'context',
    'tasks',
    'decisions',
    'knowledge',
    'agents',
    'task-summaries',
];
/**
 * Standard file names for special files in the .ai/ directory.
 */
exports.MEMORY_FILE_NAMES = {
    /** Project context file in context/ */
    PROJECT_CONTEXT: 'project.md',
    /** Current task tracker file in context/ */
    CURRENT_TASK: 'current-task.md',
};
/**
 * Creates a MemoryDirectoryLayout object with absolute paths.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns Object containing all directory paths
 *
 * @example
 * ```ts
 * const layout = createMemoryLayout('/path/to/.ai');
 * console.log(layout.contextDir); // '/path/to/.ai/context'
 * ```
 */
function createMemoryLayout(memoryRootDir) {
    return {
        memoryRootDir: memoryRootDir,
        contextDir: node_path_1.default.join(memoryRootDir, 'context'),
        tasksDir: node_path_1.default.join(memoryRootDir, 'tasks'),
        decisionsDir: node_path_1.default.join(memoryRootDir, 'decisions'),
        knowledgeDir: node_path_1.default.join(memoryRootDir, 'knowledge'),
        agentsDir: node_path_1.default.join(memoryRootDir, 'agents'),
        taskSummariesDir: node_path_1.default.join(memoryRootDir, 'task-summaries'),
    };
}
/**
 * Infers the document type from a relative path within .ai/.
 *
 * @param relativePath - Path relative to .ai/ root (e.g., 'tasks/task-123.md')
 * @returns The inferred document type, or null if unable to determine
 *
 * @example
 * ```ts
 * inferDocumentType('tasks/task-123.md');      // 'TASK'
 * inferDocumentType('decisions/arch.md');      // 'DECISION'
 * inferDocumentType('context/project.md');     // 'PROJECT'
 * inferDocumentType('agents/seo-specialist.md');// 'AGENT'
 * ```
 */
function inferDocumentType(relativePath) {
    var normalizedPath = relativePath.toLowerCase().replace(/\\/g, '/');
    // Project context files
    if (normalizedPath === 'context/project.md' || normalizedPath.startsWith('context/')) {
        return 'PROJECT';
    }
    // Task files
    if (normalizedPath.startsWith('tasks/') || normalizedPath.includes('/tasks/')) {
        return 'TASK';
    }
    // Decision records
    if (normalizedPath.startsWith('decisions/') || normalizedPath.includes('/decisions/')) {
        return 'DECISION';
    }
    // Knowledge base
    if (normalizedPath.startsWith('knowledge/') || normalizedPath.includes('/knowledge/')) {
        return 'KNOWLEDGE';
    }
    // Agent-specific memory
    if (normalizedPath.startsWith('agents/') || normalizedPath.includes('/agents/')) {
        return 'AGENT';
    }
    // Task summaries (shared across system)
    if (normalizedPath.startsWith('task-summaries/') || normalizedPath.includes('/task-summaries/')) {
        return 'SHARED';
    }
    return null;
}
/**
 * Formats a template string by replacing placeholder values.
 *
 * Supported placeholders:
 * - {{date}} - Current date in ISO format
 * - {{year}} - Current year
 * - {{month}} - Current month
 * - {{day}} - Current day
 *
 * @param template - Template string with placeholders
 * @param date - Date to use for replacements (defaults to now)
 * @returns Formatted template string
 *
 * @example
 * ```ts
 * formatTemplate('{{date}}: Some content');
 * // Returns: '2026-03-25: Some content'
 * ```
 */
function formatTemplate(template, date) {
    if (date === void 0) { date = new Date(); }
    var year = date.getFullYear().toString();
    var month = (date.getMonth() + 1).toString().padStart(2, '0');
    var day = date.getDate().toString().padStart(2, '0');
    var isoDate = "".concat(year, "-").concat(month, "-").concat(day);
    return template
        .replace(/\{\{date\}\}/g, isoDate)
        .replace(/\{\{year\}\}/g, year)
        .replace(/\{\{month\}\}/g, month)
        .replace(/\{\{day\}\}/g, day);
}
/**
 * Validates if a string is a valid MemoryDocumentType.
 *
 * @param value - String to validate
 * @returns true if the value is a valid document type
 */
function isValidDocumentType(value) {
    return exports.MEMORY_DOCUMENT_TYPES.includes(value);
}
/**
 * Gets the subdirectory name for a given document type.
 *
 * @param documentType - The document type
 * @returns The subdirectory name for that type
 */
function getSubdirectoryForType(documentType) {
    switch (documentType) {
        case 'PROJECT':
            return 'context';
        case 'TASK':
            return 'tasks';
        case 'DECISION':
            return 'decisions';
        case 'KNOWLEDGE':
            return 'knowledge';
        case 'AGENT':
            return 'agents';
        case 'SHARED':
            return 'task-summaries';
    }
}
