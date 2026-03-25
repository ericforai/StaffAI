"use strict";
/**
 * Memory Retriever Type Definitions
 *
 * Defines the complete interface system for memory retrieval across
 * different document types and contexts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORY_TYPE_WEIGHTS = exports.MEMORY_DIRECTORY_MAP = void 0;
/**
 * Maps document types to their standard directory paths within .ai/
 */
exports.MEMORY_DIRECTORY_MAP = {
    project: '.ai/context/',
    task: '.ai/tasks/',
    decision: '.ai/decisions/',
    knowledge: '.ai/knowledge/',
    agent: '.ai/agents/',
};
/**
 * Scoring weights for different memory document types.
 * Higher values indicate higher relevance priority in search results.
 */
exports.MEMORY_TYPE_WEIGHTS = {
    project: 1.0,
    task: 1.2,
    decision: 1.5,
    knowledge: 1.3,
    agent: 1.1,
};
