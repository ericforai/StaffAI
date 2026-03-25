"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileTaskRepository = createFileTaskRepository;
exports.createFileApprovalRepository = createFileApprovalRepository;
exports.createFileExecutionRepository = createFileExecutionRepository;
exports.createInMemoryTaskRepository = createInMemoryTaskRepository;
exports.createInMemoryApprovalRepository = createInMemoryApprovalRepository;
exports.createInMemoryExecutionRepository = createInMemoryExecutionRepository;
exports.createFileTaskAssignmentRepository = createFileTaskAssignmentRepository;
exports.createFileWorkflowPlanRepository = createFileWorkflowPlanRepository;
exports.createInMemoryTaskAssignmentRepository = createInMemoryTaskAssignmentRepository;
exports.createInMemoryWorkflowPlanRepository = createInMemoryWorkflowPlanRepository;
exports.createFileToolCallLogRepository = createFileToolCallLogRepository;
exports.createInMemoryToolCallLogRepository = createInMemoryToolCallLogRepository;
var node_fs_1 = __importDefault(require("node:fs"));
function readJsonFile(filePath, fallback) {
    if (!node_fs_1.default.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(node_fs_1.default.readFileSync(filePath, 'utf-8'));
}
function writeJsonFile(filePath, data) {
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
function createFileTaskRepository(filePath) {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, readJsonFile(filePath, [])];
                });
            });
        },
        getById: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).find(function (task) { return task.id === taskId; }) || null];
                    }
                });
            });
        },
        save: function (task) {
            return __awaiter(this, void 0, void 0, function () {
                var tasks;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            tasks = _a.sent();
                            tasks.push(task);
                            writeJsonFile(filePath, tasks);
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (taskId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var tasks, index, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            tasks = _a.sent();
                            index = tasks.findIndex(function (task) { return task.id === taskId; });
                            if (index < 0) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(tasks[index]);
                            tasks[index] = updated;
                            writeJsonFile(filePath, tasks);
                            return [2 /*return*/, updated];
                    }
                });
            });
        },
    };
}
function createFileApprovalRepository(filePath) {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, readJsonFile(filePath, [])];
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).filter(function (approval) { return approval.taskId === taskId; })];
                    }
                });
            });
        },
        save: function (approval) {
            return __awaiter(this, void 0, void 0, function () {
                var approvals;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            approvals = _a.sent();
                            approvals.push(approval);
                            writeJsonFile(filePath, approvals);
                            return [2 /*return*/];
                    }
                });
            });
        },
        updateStatus: function (approvalId, status) {
            return __awaiter(this, void 0, void 0, function () {
                var approvals, target;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            approvals = _a.sent();
                            target = approvals.find(function (approval) { return approval.id === approvalId; });
                            if (!target) {
                                return [2 /*return*/, null];
                            }
                            target.status = status;
                            target.resolvedAt = new Date().toISOString();
                            writeJsonFile(filePath, approvals);
                            return [2 /*return*/, target];
                    }
                });
            });
        },
    };
}
function createFileExecutionRepository(filePath) {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, readJsonFile(filePath, [])];
                });
            });
        },
        getById: function (executionId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).find(function (execution) { return execution.id === executionId; }) || null];
                    }
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).filter(function (execution) { return execution.taskId === taskId; })];
                    }
                });
            });
        },
        save: function (execution) {
            return __awaiter(this, void 0, void 0, function () {
                var executions;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            executions = _a.sent();
                            executions.push(execution);
                            writeJsonFile(filePath, executions);
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (executionId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var executions, index, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            executions = _a.sent();
                            index = executions.findIndex(function (execution) { return execution.id === executionId; });
                            if (index < 0) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(executions[index]);
                            executions[index] = updated;
                            writeJsonFile(filePath, executions);
                            return [2 /*return*/, updated];
                    }
                });
            });
        },
    };
}
function createInMemoryTaskRepository(seed) {
    if (seed === void 0) { seed = []; }
    var tasks = __spreadArray([], seed, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, __spreadArray([], tasks, true)];
                });
            });
        },
        getById: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, tasks.find(function (task) { return task.id === taskId; }) || null];
                });
            });
        },
        save: function (task) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    tasks.push(task);
                    return [2 /*return*/];
                });
            });
        },
        update: function (taskId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var index;
                return __generator(this, function (_a) {
                    index = tasks.findIndex(function (task) { return task.id === taskId; });
                    if (index < 0) {
                        return [2 /*return*/, null];
                    }
                    tasks[index] = updater(tasks[index]);
                    return [2 /*return*/, tasks[index]];
                });
            });
        },
    };
}
function createInMemoryApprovalRepository(seed) {
    if (seed === void 0) { seed = []; }
    var approvals = __spreadArray([], seed, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, __spreadArray([], approvals, true)];
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, approvals.filter(function (approval) { return approval.taskId === taskId; })];
                });
            });
        },
        save: function (approval) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    approvals.push(approval);
                    return [2 /*return*/];
                });
            });
        },
        updateStatus: function (approvalId, status) {
            return __awaiter(this, void 0, void 0, function () {
                var target;
                return __generator(this, function (_a) {
                    target = approvals.find(function (approval) { return approval.id === approvalId; });
                    if (!target) {
                        return [2 /*return*/, null];
                    }
                    target.status = status;
                    target.resolvedAt = new Date().toISOString();
                    return [2 /*return*/, target];
                });
            });
        },
    };
}
function createInMemoryExecutionRepository(seed) {
    if (seed === void 0) { seed = []; }
    var executions = __spreadArray([], seed, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, __spreadArray([], executions, true)];
                });
            });
        },
        getById: function (executionId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, executions.find(function (execution) { return execution.id === executionId; }) || null];
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, executions.filter(function (execution) { return execution.taskId === taskId; })];
                });
            });
        },
        save: function (execution) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    executions.push(execution);
                    return [2 /*return*/];
                });
            });
        },
        update: function (executionId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var index;
                return __generator(this, function (_a) {
                    index = executions.findIndex(function (execution) { return execution.id === executionId; });
                    if (index < 0) {
                        return [2 /*return*/, null];
                    }
                    executions[index] = updater(executions[index]);
                    return [2 /*return*/, executions[index]];
                });
            });
        },
    };
}
function createFileTaskAssignmentRepository(filePath) {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, readJsonFile(filePath, [])];
                });
            });
        },
        getById: function (assignmentId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).find(function (assignment) { return assignment.id === assignmentId; }) || null];
                    }
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).filter(function (assignment) { return assignment.taskId === taskId; })];
                    }
                });
            });
        },
        save: function (assignment) {
            return __awaiter(this, void 0, void 0, function () {
                var assignments;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            assignments = _a.sent();
                            assignments.push(assignment);
                            writeJsonFile(filePath, assignments);
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (assignmentId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var assignments, index, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            assignments = _a.sent();
                            index = assignments.findIndex(function (assignment) { return assignment.id === assignmentId; });
                            if (index < 0) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(assignments[index]);
                            assignments[index] = updated;
                            writeJsonFile(filePath, assignments);
                            return [2 /*return*/, updated];
                    }
                });
            });
        },
    };
}
function createFileWorkflowPlanRepository(filePath) {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, readJsonFile(filePath, [])];
                });
            });
        },
        getByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).find(function (plan) { return plan.taskId === taskId; }) || null];
                    }
                });
            });
        },
        save: function (plan) {
            return __awaiter(this, void 0, void 0, function () {
                var plans;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            plans = _a.sent();
                            plans.push(plan);
                            writeJsonFile(filePath, plans);
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (taskId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var plans, index, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            plans = _a.sent();
                            index = plans.findIndex(function (plan) { return plan.taskId === taskId; });
                            if (index < 0) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(plans[index]);
                            plans[index] = updated;
                            writeJsonFile(filePath, plans);
                            return [2 /*return*/, updated];
                    }
                });
            });
        },
    };
}
function createInMemoryTaskAssignmentRepository(seed) {
    if (seed === void 0) { seed = []; }
    var assignments = __spreadArray([], seed, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, __spreadArray([], assignments, true)];
                });
            });
        },
        getById: function (assignmentId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, assignments.find(function (assignment) { return assignment.id === assignmentId; }) || null];
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, assignments.filter(function (assignment) { return assignment.taskId === taskId; })];
                });
            });
        },
        save: function (assignment) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    assignments.push(assignment);
                    return [2 /*return*/];
                });
            });
        },
        update: function (assignmentId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var index;
                return __generator(this, function (_a) {
                    index = assignments.findIndex(function (assignment) { return assignment.id === assignmentId; });
                    if (index < 0) {
                        return [2 /*return*/, null];
                    }
                    assignments[index] = updater(assignments[index]);
                    return [2 /*return*/, assignments[index]];
                });
            });
        },
    };
}
function createInMemoryWorkflowPlanRepository(seed) {
    if (seed === void 0) { seed = []; }
    var plans = __spreadArray([], seed, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, __spreadArray([], plans, true)];
                });
            });
        },
        getByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, plans.find(function (plan) { return plan.taskId === taskId; }) || null];
                });
            });
        },
        save: function (plan) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    plans.push(plan);
                    return [2 /*return*/];
                });
            });
        },
        update: function (taskId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var index;
                return __generator(this, function (_a) {
                    index = plans.findIndex(function (plan) { return plan.taskId === taskId; });
                    if (index < 0) {
                        return [2 /*return*/, null];
                    }
                    plans[index] = updater(plans[index]);
                    return [2 /*return*/, plans[index]];
                });
            });
        },
    };
}
function createFileToolCallLogRepository(filePath) {
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, readJsonFile(filePath, [])];
                });
            });
        },
        getById: function (toolCallLogId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).find(function (toolCallLog) { return toolCallLog.id === toolCallLogId; }) || null];
                    }
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).filter(function (toolCallLog) { return toolCallLog.taskId === taskId; })];
                    }
                });
            });
        },
        listByExecutionId: function (executionId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1: return [2 /*return*/, (_a.sent()).filter(function (toolCallLog) { return toolCallLog.executionId === executionId; })];
                    }
                });
            });
        },
        save: function (toolCallLog) {
            return __awaiter(this, void 0, void 0, function () {
                var toolCallLogs;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            toolCallLogs = _a.sent();
                            toolCallLogs.push(toolCallLog);
                            writeJsonFile(filePath, toolCallLogs);
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (toolCallLogId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var toolCallLogs, index, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            toolCallLogs = _a.sent();
                            index = toolCallLogs.findIndex(function (toolCallLog) { return toolCallLog.id === toolCallLogId; });
                            if (index < 0) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(toolCallLogs[index]);
                            toolCallLogs[index] = updated;
                            writeJsonFile(filePath, toolCallLogs);
                            return [2 /*return*/, updated];
                    }
                });
            });
        },
    };
}
function createInMemoryToolCallLogRepository(seed) {
    if (seed === void 0) { seed = []; }
    var toolCallLogs = __spreadArray([], seed, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, __spreadArray([], toolCallLogs, true)];
                });
            });
        },
        getById: function (toolCallLogId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, toolCallLogs.find(function (toolCallLog) { return toolCallLog.id === toolCallLogId; }) || null];
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, toolCallLogs.filter(function (toolCallLog) { return toolCallLog.taskId === taskId; })];
                });
            });
        },
        listByExecutionId: function (executionId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, toolCallLogs.filter(function (toolCallLog) { return toolCallLog.executionId === executionId; })];
                });
            });
        },
        save: function (toolCallLog) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    toolCallLogs.push(toolCallLog);
                    return [2 /*return*/];
                });
            });
        },
        update: function (toolCallLogId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var index;
                return __generator(this, function (_a) {
                    index = toolCallLogs.findIndex(function (toolCallLog) { return toolCallLog.id === toolCallLogId; });
                    if (index < 0) {
                        return [2 /*return*/, null];
                    }
                    toolCallLogs[index] = updater(toolCallLogs[index]);
                    return [2 /*return*/, toolCallLogs[index]];
                });
            });
        },
    };
}
