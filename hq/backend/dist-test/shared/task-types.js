"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ADVANCED_EXECUTION_MODE = exports.TASK_EXECUTION_MODES = exports.TOOL_RISK_LEVELS = exports.TOOL_CALL_STATUSES = exports.TOOL_DEFINITION_CATEGORIES = exports.TOOL_CATEGORIES = exports.WORKFLOW_PLAN_MODES = exports.TASK_ASSIGNMENT_STATUSES = exports.TASK_RISK_LEVELS = exports.TASK_TYPES = exports.TASK_PRIORITIES = exports.EXECUTION_STATUSES = exports.APPROVAL_STATUSES = exports.TASK_STATUSES = void 0;
exports.TASK_STATUSES = [
    'created',
    'routed',
    'running',
    'waiting_approval',
    'completed',
    'failed',
    'cancelled',
];
exports.APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];
exports.EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed', 'degraded'];
exports.TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
exports.TASK_TYPES = [
    'architecture_analysis',
    'backend_implementation',
    'code_review',
    'documentation',
    'workflow_dispatch',
    'frontend_implementation',
    'quality_assurance',
    'general',
];
exports.TASK_RISK_LEVELS = ['low', 'medium', 'high'];
exports.TASK_ASSIGNMENT_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'];
exports.WORKFLOW_PLAN_MODES = ['single', 'serial', 'parallel'];
exports.TOOL_CATEGORIES = ['knowledge', 'runtime', 'filesystem', 'repository', 'quality'];
exports.TOOL_DEFINITION_CATEGORIES = exports.TOOL_CATEGORIES;
exports.TOOL_CALL_STATUSES = ['pending', 'running', 'completed', 'failed', 'blocked'];
exports.TOOL_RISK_LEVELS = ['low', 'medium', 'high'];
exports.TASK_EXECUTION_MODES = ['single', 'serial', 'parallel', 'advanced_discussion'];
exports.DEFAULT_ADVANCED_EXECUTION_MODE = 'advanced_discussion';
