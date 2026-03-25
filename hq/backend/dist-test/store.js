"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.Store = void 0;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var events_1 = require("events");
var file_repositories_1 = require("./persistence/file-repositories");
var postgres_repositories_1 = require("./persistence/postgres-repositories");
var STORE_FILE = path_1.default.join(__dirname, '../../active_squad.json');
var TEMPLATES_FILE = path_1.default.join(__dirname, '../../templates.json');
var KNOWLEDGE_FILE = path_1.default.join(__dirname, '../../company_knowledge.json');
var APPROVALS_FILE = process.env.AGENCY_APPROVALS_FILE || path_1.default.join(__dirname, '../../approvals.json');
var EXECUTIONS_FILE = process.env.AGENCY_EXECUTIONS_FILE || path_1.default.join(__dirname, '../../executions.json');
var ASSIGNMENTS_FILE = process.env.AGENCY_TASK_ASSIGNMENTS_FILE || path_1.default.join(__dirname, '../../task_assignments.json');
var WORKFLOW_PLANS_FILE = process.env.AGENCY_WORKFLOW_PLANS_FILE || path_1.default.join(__dirname, '../../workflow_plans.json');
var TOOL_CALL_LOGS_FILE = process.env.AGENCY_TOOL_CALL_LOGS_FILE || path_1.default.join(__dirname, '../../tool_call_logs.json');
function getTasksFilePath() {
    return process.env.AGENCY_TASKS_FILE || path_1.default.join(__dirname, '../../tasks.json');
}
function getApprovalsFilePath() {
    return process.env.AGENCY_APPROVALS_FILE || APPROVALS_FILE;
}
function getExecutionsFilePath() {
    return process.env.AGENCY_EXECUTIONS_FILE || EXECUTIONS_FILE;
}
function getTaskAssignmentsFilePath() {
    return process.env.AGENCY_TASK_ASSIGNMENTS_FILE || ASSIGNMENTS_FILE;
}
function getWorkflowPlansFilePath() {
    return process.env.AGENCY_WORKFLOW_PLANS_FILE || WORKFLOW_PLANS_FILE;
}
function getToolCallLogsFilePath() {
    return process.env.AGENCY_TOOL_CALL_LOGS_FILE || TOOL_CALL_LOGS_FILE;
}
function getPersistenceMode() {
    var raw = (process.env.AGENCY_PERSISTENCE_MODE || 'file').toLowerCase();
    if (raw === 'postgres') {
        return 'postgres';
    }
    return raw === 'memory' ? 'memory' : 'file';
}
function getPostgresConnectionString() {
    var value = process.env.AGENCY_POSTGRES_URL || process.env.DATABASE_URL;
    if (!value) {
        throw new Error('Postgres persistence requires AGENCY_POSTGRES_URL or DATABASE_URL when AGENCY_PERSISTENCE_MODE=postgres');
    }
    return value;
}
var Store = /** @class */ (function (_super) {
    __extends(Store, _super);
    function Store(dependencies) {
        if (dependencies === void 0) { dependencies = {}; }
        var _a, _b, _c, _d, _e, _f;
        var _this = _super.call(this) || this;
        _this.state = { activeAgentIds: [] };
        var mode = getPersistenceMode();
        var postgresOptions = mode === 'postgres'
            ? {
                connectionString: getPostgresConnectionString(),
                schema: process.env.AGENCY_POSTGRES_SCHEMA || 'public',
                taskTable: process.env.AGENCY_POSTGRES_TASKS_TABLE,
                approvalTable: process.env.AGENCY_POSTGRES_APPROVALS_TABLE,
                executionTable: process.env.AGENCY_POSTGRES_EXECUTIONS_TABLE,
            }
            : null;
        _this.taskRepository =
            (_a = dependencies.taskRepository) !== null && _a !== void 0 ? _a : (mode === 'memory'
                ? (0, file_repositories_1.createInMemoryTaskRepository)()
                : mode === 'postgres'
                    ? (0, postgres_repositories_1.createPostgresTaskRepository)(postgresOptions)
                    : (0, file_repositories_1.createFileTaskRepository)(getTasksFilePath()));
        _this.approvalRepository =
            (_b = dependencies.approvalRepository) !== null && _b !== void 0 ? _b : (mode === 'memory'
                ? (0, file_repositories_1.createInMemoryApprovalRepository)()
                : mode === 'postgres'
                    ? (0, postgres_repositories_1.createPostgresApprovalRepository)(postgresOptions)
                    : (0, file_repositories_1.createFileApprovalRepository)(getApprovalsFilePath()));
        _this.executionRepository =
            (_c = dependencies.executionRepository) !== null && _c !== void 0 ? _c : (mode === 'memory'
                ? (0, file_repositories_1.createInMemoryExecutionRepository)()
                : mode === 'postgres'
                    ? (0, postgres_repositories_1.createPostgresExecutionRepository)(postgresOptions)
                    : (0, file_repositories_1.createFileExecutionRepository)(getExecutionsFilePath()));
        _this.taskAssignmentRepository =
            (_d = dependencies.taskAssignmentRepository) !== null && _d !== void 0 ? _d : (mode === 'memory'
                ? (0, file_repositories_1.createInMemoryTaskAssignmentRepository)()
                : (0, file_repositories_1.createFileTaskAssignmentRepository)(getTaskAssignmentsFilePath()));
        _this.workflowPlanRepository =
            (_e = dependencies.workflowPlanRepository) !== null && _e !== void 0 ? _e : (mode === 'memory'
                ? (0, file_repositories_1.createInMemoryWorkflowPlanRepository)()
                : (0, file_repositories_1.createFileWorkflowPlanRepository)(getWorkflowPlansFilePath()));
        _this.toolCallLogRepository =
            (_f = dependencies.toolCallLogRepository) !== null && _f !== void 0 ? _f : (mode === 'memory'
                ? (0, file_repositories_1.createInMemoryToolCallLogRepository)()
                : (0, file_repositories_1.createFileToolCallLogRepository)(getToolCallLogsFilePath()));
        _this.load();
        return _this;
    }
    Store.prototype.load = function () {
        try {
            if (fs_1.default.existsSync(STORE_FILE)) {
                var data = fs_1.default.readFileSync(STORE_FILE, 'utf-8');
                this.state = JSON.parse(data);
            }
        }
        catch (err) {
            console.error('Failed to load active squad:', err);
        }
    };
    Store.prototype.save = function (activeAgentIds) {
        this.state = { activeAgentIds: activeAgentIds };
        fs_1.default.writeFileSync(STORE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
        this.emit('changed', this.state);
    };
    Store.prototype.getActiveIds = function () {
        try {
            if (fs_1.default.existsSync(STORE_FILE)) {
                var data = fs_1.default.readFileSync(STORE_FILE, 'utf-8');
                var parsed = JSON.parse(data);
                return parsed.activeAgentIds || [];
            }
        }
        catch (err) {
            // fallback
        }
        return this.state.activeAgentIds;
    };
    // --- Templates Logic ---
    Store.prototype.getTemplates = function () {
        try {
            if (fs_1.default.existsSync(TEMPLATES_FILE)) {
                return JSON.parse(fs_1.default.readFileSync(TEMPLATES_FILE, 'utf-8'));
            }
        }
        catch (err) { }
        return [];
    };
    Store.prototype.saveTemplate = function (name, activeAgentIds) {
        var templates = this.getTemplates();
        var index = templates.findIndex(function (t) { return t.name === name; });
        if (index >= 0) {
            templates[index].activeAgentIds = activeAgentIds;
        }
        else {
            templates.push({ name: name, activeAgentIds: activeAgentIds });
        }
        fs_1.default.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    };
    Store.prototype.deleteTemplate = function (name) {
        var templates = this.getTemplates().filter(function (t) { return t.name !== name; });
        fs_1.default.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    };
    // --- Knowledge Base Logic ---
    Store.prototype.getKnowledge = function () {
        try {
            if (fs_1.default.existsSync(KNOWLEDGE_FILE)) {
                return JSON.parse(fs_1.default.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
            }
        }
        catch (err) {
            console.error('Failed to load knowledge:', err);
        }
        return [];
    };
    Store.prototype.saveKnowledge = function (entry) {
        var knowledge = this.getKnowledge();
        knowledge.push(__assign(__assign({}, entry), { timestamp: Date.now() }));
        // 保留最近 100 条记录，防止无限增长
        var MAX_KNOWLEDGE_ENTRIES = 100;
        if (knowledge.length > MAX_KNOWLEDGE_ENTRIES) {
            knowledge.splice(0, knowledge.length - MAX_KNOWLEDGE_ENTRIES);
        }
        fs_1.default.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2), 'utf-8');
    };
    /**
     * 特征提取：支持中文字符和英文单词
     */
    Store.prototype.getFeatures = function (text) {
        var features = new Map();
        var words = text.toLowerCase().split(/[\s,，.。!！?？\-_/]+/).filter(function (t) { return t.length > 0; });
        words.forEach(function (w) { return features.set(w, (features.get(w) || 0) + 1); });
        // 中文按字符提取
        for (var i = 0; i < text.length; i++) {
            var char = text[i];
            if (/[\u4e00-\u9fa5]/.test(char)) {
                features.set(char, (features.get(char) || 0) + 1);
            }
        }
        return features;
    };
    /**
     * 计算知识条目与查询的相关性得分
     * 使用与专家匹配相同的语义匹配算法
     */
    Store.prototype.calculateKnowledgeScore = function (entry, query) {
        var queryFeatures = this.getFeatures(query);
        var taskFeatures = this.getFeatures(entry.task);
        var resultFeatures = this.getFeatures(entry.resultSummary);
        var agentFeatures = this.getFeatures(entry.agentId);
        var score = 0;
        queryFeatures.forEach(function (count, feature) {
            // 任务描述权重最高
            if (taskFeatures.has(feature))
                score += count * taskFeatures.get(feature) * 5;
            // 结果摘要次之
            if (resultFeatures.has(feature))
                score += count * resultFeatures.get(feature) * 3;
            // 专家 ID 也有参考价值
            if (agentFeatures.has(feature))
                score += count * agentFeatures.get(feature) * 2;
        });
        return score;
    };
    /**
     * 语义搜索知识库
     * 返回最相关的 3 条记录
     */
    Store.prototype.searchKnowledge = function (query, limit) {
        var _this = this;
        if (limit === void 0) { limit = 3; }
        var knowledge = this.getKnowledge();
        if (!query)
            return [];
        // 计算每条记录的相关性得分
        var scored = knowledge
            .map(function (entry) { return ({
            entry: entry,
            score: _this.calculateKnowledgeScore(entry, query)
        }); })
            .filter(function (item) { return item.score > 0; })
            .sort(function (a, b) { return b.score - a.score; });
        // 返回得分最高的 N 条
        return scored.slice(0, limit).map(function (item) { return item.entry; });
    };
    // --- Task Logic ---
    Store.prototype.getTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.taskRepository.list()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        err_1 = _a.sent();
                        console.error('Failed to load tasks:', err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, []];
                }
            });
        });
    };
    Store.prototype.saveTask = function (task) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskRepository.save(task)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.getTaskById = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskRepository.getById(taskId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.updateTask = function (taskId, updater) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskRepository.update(taskId, updater)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // --- Approval Logic ---
    Store.prototype.getApprovals = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.approvalRepository.list()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        err_2 = _a.sent();
                        console.error('Failed to load approvals:', err_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, []];
                }
            });
        });
    };
    Store.prototype.saveApproval = function (approval) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.approvalRepository.save(approval)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.updateApprovalStatus = function (approvalId, status) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.approvalRepository.updateStatus(approvalId, status)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.getApprovalsByTaskId = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.approvalRepository.listByTaskId(taskId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // --- Execution Logic ---
    Store.prototype.getExecutions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.executionRepository.list()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        err_3 = _a.sent();
                        console.error('Failed to load executions:', err_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, []];
                }
            });
        });
    };
    Store.prototype.saveExecution = function (execution) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executionRepository.save(execution)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.updateExecution = function (executionId, updater) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executionRepository.update(executionId, updater)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.getExecutionById = function (executionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executionRepository.getById(executionId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.getExecutionsByTaskId = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.executionRepository.listByTaskId(taskId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // --- Assignment Logic ---
    Store.prototype.getTaskAssignments = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskAssignmentRepository.list()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.saveTaskAssignment = function (taskAssignment) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskAssignmentRepository.save(taskAssignment)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.getTaskAssignmentById = function (assignmentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskAssignmentRepository.getById(assignmentId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.getTaskAssignmentsByTaskId = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskAssignmentRepository.listByTaskId(taskId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.updateTaskAssignment = function (assignmentId, updater) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskAssignmentRepository.update(assignmentId, updater)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // --- Workflow Plan Logic ---
    Store.prototype.getWorkflowPlans = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workflowPlanRepository.list()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.saveWorkflowPlan = function (workflowPlan) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workflowPlanRepository.save(workflowPlan)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.getWorkflowPlanByTaskId = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workflowPlanRepository.getByTaskId(taskId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.updateWorkflowPlan = function (taskId, updater) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.workflowPlanRepository.update(taskId, updater)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // --- Tool Call Log Logic ---
    Store.prototype.getToolCallLogs = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toolCallLogRepository.list()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.saveToolCallLog = function (toolCallLog) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toolCallLogRepository.save(toolCallLog)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.getToolCallLogById = function (toolCallLogId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toolCallLogRepository.getById(toolCallLogId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.getToolCallLogsByTaskId = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toolCallLogRepository.listByTaskId(taskId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Store.prototype.getToolCallLogsByExecutionId = function (executionId) {
        return __awaiter(this, void 0, void 0, function () {
            var toolCallLogs, execution, executionWithToolCalls;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.toolCallLogRepository.listByExecutionId(executionId)];
                    case 1:
                        toolCallLogs = _b.sent();
                        if (toolCallLogs.length > 0) {
                            return [2 /*return*/, toolCallLogs];
                        }
                        return [4 /*yield*/, this.executionRepository.getById(executionId)];
                    case 2:
                        execution = _b.sent();
                        executionWithToolCalls = execution;
                        return [2 /*return*/, (_a = executionWithToolCalls === null || executionWithToolCalls === void 0 ? void 0 : executionWithToolCalls.toolCalls) !== null && _a !== void 0 ? _a : []];
                }
            });
        });
    };
    Store.prototype.updateToolCallLog = function (toolCallLogId, updater) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toolCallLogRepository.update(toolCallLogId, updater)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return Store;
}(events_1.EventEmitter));
exports.Store = Store;
