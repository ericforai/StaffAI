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
exports.buildSerialWorkflowPlan = buildSerialWorkflowPlan;
exports.runTaskExecution = runTaskExecution;
exports.beginExecution = beginExecution;
exports.completeExecution = completeExecution;
exports.failExecution = failExecution;
var node_crypto_1 = require("node:crypto");
var runtime_adapter_1 = require("./runtime-adapter");
function createSerialWorkflowBundle(input) {
    var now = new Date().toISOString();
    var workflowPlanId = (0, node_crypto_1.randomUUID)();
    var firstAssignmentId = (0, node_crypto_1.randomUUID)();
    var secondAssignmentId = (0, node_crypto_1.randomUUID)();
    var firstStepId = (0, node_crypto_1.randomUUID)();
    var secondStepId = (0, node_crypto_1.randomUUID)();
    return {
        workflowPlan: {
            id: workflowPlanId,
            taskId: input.taskId,
            mode: 'serial',
            synthesisRequired: true,
            status: 'planned',
            createdAt: now,
            updatedAt: now,
            steps: [
                {
                    id: firstStepId,
                    order: 1,
                    title: "Draft ".concat(input.title),
                    assignmentId: firstAssignmentId,
                    agentId: input.primaryRole,
                    assignmentRole: 'primary',
                    status: 'pending',
                },
                {
                    id: secondStepId,
                    order: 2,
                    title: "Review and finalize ".concat(input.title),
                    assignmentId: secondAssignmentId,
                    agentId: 'dispatcher',
                    assignmentRole: 'dispatcher',
                    status: 'pending',
                },
            ],
        },
        assignments: [
            {
                id: firstAssignmentId,
                taskId: input.taskId,
                workflowPlanId: workflowPlanId,
                stepId: firstStepId,
                agentId: input.primaryRole,
                assignmentRole: 'primary',
                status: 'pending',
            },
            {
                id: secondAssignmentId,
                taskId: input.taskId,
                workflowPlanId: workflowPlanId,
                stepId: secondStepId,
                agentId: 'dispatcher',
                assignmentRole: 'dispatcher',
                status: 'pending',
            },
        ],
    };
}
function completeSerialWorkflowBundle(bundle) {
    var completedAt = new Date().toISOString();
    return {
        workflowPlan: __assign(__assign({}, bundle.workflowPlan), { status: 'completed', updatedAt: completedAt, steps: bundle.workflowPlan.steps.map(function (step) { return (__assign(__assign({}, step), { status: 'completed' })); }) }),
        assignments: bundle.assignments.map(function (assignment) {
            var _a;
            return (__assign(__assign({}, assignment), { status: 'completed', startedAt: (_a = assignment.startedAt) !== null && _a !== void 0 ? _a : completedAt, endedAt: completedAt, completedAt: completedAt }));
        }),
    };
}
function completeWorkflowArtifacts(input) {
    if (!input.workflowPlan || !input.assignments || input.assignments.length === 0) {
        return {};
    }
    var completedAt = new Date().toISOString();
    var assignments = input.assignments.map(function (assignment) {
        var _a;
        return (__assign(__assign({}, assignment), { status: 'completed', startedAt: (_a = assignment.startedAt) !== null && _a !== void 0 ? _a : completedAt, endedAt: completedAt, completedAt: completedAt, updatedAt: completedAt }));
    });
    var assignmentIds = new Set(assignments.map(function (assignment) { return assignment.id; }));
    return {
        assignments: assignments,
        workflowPlan: __assign(__assign({}, input.workflowPlan), { status: 'completed', updatedAt: completedAt, steps: input.workflowPlan.steps.map(function (step) { return (__assign(__assign({}, step), { status: assignmentIds.has(step.assignmentId) ? 'completed' : step.status })); }) }),
    };
}
function buildSerialWorkflowPlan(input) {
    return createSerialWorkflowBundle({
        taskId: input.id,
        title: input.title,
        primaryRole: input.recommendedAgentRole || 'software-architect',
    });
}
function runTaskExecution(input, store) {
    return __awaiter(this, void 0, void 0, function () {
        var timeoutMs, maxRetries, runtimeName, runtimeAdapter, serialBundle, completedWorkflowArtifacts, started, lastError, finalizedExecution, finalizedWorkflowArtifacts, finalAttempt, attempt, runtimeContext, runtimeResult, error_1, completedOrFailed, updatedPlan, _loop_1, _i, _a, assignment, task;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    timeoutMs = Number.isFinite(input.timeoutMs) && ((_b = input.timeoutMs) !== null && _b !== void 0 ? _b : 0) > 0 ? input.timeoutMs : 30000;
                    maxRetries = Number.isFinite(input.maxRetries) && ((_c = input.maxRetries) !== null && _c !== void 0 ? _c : 0) >= 0 ? input.maxRetries : 1;
                    runtimeName = input.runtimeName || (0, runtime_adapter_1.resolveRuntimeName)(input.executor);
                    runtimeAdapter = (0, runtime_adapter_1.resolveRuntimeAdapter)(input.executor);
                    serialBundle = input.executionMode === 'serial'
                        ? input.workflowPlan && input.assignments
                            ? {
                                workflowPlan: input.workflowPlan,
                                assignments: input.assignments,
                            }
                            : buildSerialWorkflowPlan({
                                id: input.taskId,
                                title: (_d = input.taskTitle) !== null && _d !== void 0 ? _d : input.taskId,
                                description: input.summary,
                                executionMode: 'serial',
                                recommendedAgentRole: (_e = input.recommendedAgentRole) !== null && _e !== void 0 ? _e : 'software-architect',
                            })
                        : undefined;
                    completedWorkflowArtifacts = serialBundle !== null && serialBundle !== void 0 ? serialBundle : (input.workflowPlan && input.assignments
                        ? completeWorkflowArtifacts({
                            workflowPlan: input.workflowPlan,
                            assignments: input.assignments,
                        })
                        : undefined);
                    started = beginExecution({
                        taskId: input.taskId,
                        executor: input.executor,
                        runtimeName: runtimeName,
                        degraded: input.degraded,
                        timeoutMs: timeoutMs,
                        maxRetries: maxRetries,
                        inputSnapshot: input.inputSnapshot,
                        memoryContextExcerpt: input.memoryContextExcerpt,
                        workflowPlan: completedWorkflowArtifacts === null || completedWorkflowArtifacts === void 0 ? void 0 : completedWorkflowArtifacts.workflowPlan,
                        assignments: completedWorkflowArtifacts === null || completedWorkflowArtifacts === void 0 ? void 0 : completedWorkflowArtifacts.assignments,
                    });
                    return [4 /*yield*/, store.saveExecution(started)];
                case 1:
                    _m.sent();
                    finalizedExecution = null;
                    finalAttempt = 0;
                    attempt = 0;
                    _m.label = 2;
                case 2:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 7];
                    finalAttempt = attempt;
                    _m.label = 3;
                case 3:
                    _m.trys.push([3, 5, , 6]);
                    runtimeContext = {
                        task: (_f = input.task) !== null && _f !== void 0 ? _f : {
                            id: input.taskId,
                            title: (_g = input.taskTitle) !== null && _g !== void 0 ? _g : input.taskId,
                            description: input.summary,
                            taskType: 'general',
                            priority: 'medium',
                            status: 'running',
                            executionMode: (_h = input.executionMode) !== null && _h !== void 0 ? _h : 'single',
                            approvalRequired: false,
                            riskLevel: 'low',
                            requestedBy: 'system',
                            requestedAt: new Date().toISOString(),
                            recommendedAgentRole: (_j = input.recommendedAgentRole) !== null && _j !== void 0 ? _j : 'dispatcher',
                            candidateAgentRoles: [(_k = input.recommendedAgentRole) !== null && _k !== void 0 ? _k : 'dispatcher'],
                            routeReason: 'runtime fallback context',
                            routingStatus: 'manual_review',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                        executor: input.executor,
                        runtimeName: runtimeName,
                        executionMode: (_l = input.executionMode) !== null && _l !== void 0 ? _l : 'single',
                        summary: input.summary,
                        memoryContextExcerpt: input.memoryContextExcerpt,
                        timeoutMs: timeoutMs,
                        maxRetries: maxRetries,
                        inputSnapshot: input.inputSnapshot,
                    };
                    return [4 /*yield*/, withTimeout(input.runtimeRunner ? input.runtimeRunner(runtimeContext) : runtimeAdapter.run(runtimeContext), timeoutMs)];
                case 4:
                    runtimeResult = _m.sent();
                    finalizedWorkflowArtifacts = serialBundle
                        ? completeSerialWorkflowBundle(serialBundle)
                        : completedWorkflowArtifacts;
                    finalizedExecution = finalizedWorkflowArtifacts
                        ? completeExecution(started, {
                            summary: runtimeResult.outputSummary || input.summary,
                            outputSnapshot: runtimeResult.outputSnapshot,
                            workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
                            assignments: finalizedWorkflowArtifacts.assignments,
                            retryCount: attempt,
                            maxRetries: maxRetries,
                            timeoutMs: timeoutMs,
                            degraded: input.degraded,
                        })
                        : completeExecution(started, {
                            summary: runtimeResult.outputSummary || input.summary,
                            outputSnapshot: runtimeResult.outputSnapshot,
                            retryCount: attempt,
                            maxRetries: maxRetries,
                            timeoutMs: timeoutMs,
                            degraded: input.degraded,
                        });
                    return [3 /*break*/, 7];
                case 5:
                    error_1 = _m.sent();
                    lastError = toRuntimeError(error_1, timeoutMs);
                    if (attempt < maxRetries && lastError.retriable) {
                        return [3 /*break*/, 6];
                    }
                    return [3 /*break*/, 6];
                case 6:
                    attempt += 1;
                    return [3 /*break*/, 2];
                case 7:
                    completedOrFailed = finalizedExecution !== null && finalizedExecution !== void 0 ? finalizedExecution : failExecution(started, {
                        errorMessage: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Execution failed',
                        retryCount: finalAttempt,
                        maxRetries: maxRetries,
                        timeoutMs: timeoutMs,
                        degraded: input.degraded,
                        structuredError: lastError,
                    });
                    return [4 /*yield*/, store.updateExecution(started.id, function () { return completedOrFailed; })];
                case 8:
                    _m.sent();
                    if (!((finalizedWorkflowArtifacts === null || finalizedWorkflowArtifacts === void 0 ? void 0 : finalizedWorkflowArtifacts.workflowPlan) && finalizedWorkflowArtifacts.assignments)) return [3 /*break*/, 18];
                    if (!store.updateWorkflowPlan) return [3 /*break*/, 12];
                    return [4 /*yield*/, store.updateWorkflowPlan(input.taskId, function () { return finalizedWorkflowArtifacts.workflowPlan; })];
                case 9:
                    updatedPlan = _m.sent();
                    if (!(!updatedPlan && store.saveWorkflowPlan)) return [3 /*break*/, 11];
                    return [4 /*yield*/, store.saveWorkflowPlan(finalizedWorkflowArtifacts.workflowPlan)];
                case 10:
                    _m.sent();
                    _m.label = 11;
                case 11: return [3 /*break*/, 14];
                case 12:
                    if (!store.saveWorkflowPlan) return [3 /*break*/, 14];
                    return [4 /*yield*/, store.saveWorkflowPlan(finalizedWorkflowArtifacts.workflowPlan)];
                case 13:
                    _m.sent();
                    _m.label = 14;
                case 14:
                    _loop_1 = function (assignment) {
                        var updatedAssignment;
                        return __generator(this, function (_o) {
                            switch (_o.label) {
                                case 0:
                                    if (!store.updateTaskAssignment) return [3 /*break*/, 4];
                                    return [4 /*yield*/, store.updateTaskAssignment(assignment.id, function () { return assignment; })];
                                case 1:
                                    updatedAssignment = _o.sent();
                                    if (!(!updatedAssignment && store.saveTaskAssignment)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, store.saveTaskAssignment(assignment)];
                                case 2:
                                    _o.sent();
                                    _o.label = 3;
                                case 3: return [3 /*break*/, 6];
                                case 4:
                                    if (!store.saveTaskAssignment) return [3 /*break*/, 6];
                                    return [4 /*yield*/, store.saveTaskAssignment(assignment)];
                                case 5:
                                    _o.sent();
                                    _o.label = 6;
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = finalizedWorkflowArtifacts.assignments;
                    _m.label = 15;
                case 15:
                    if (!(_i < _a.length)) return [3 /*break*/, 18];
                    assignment = _a[_i];
                    return [5 /*yield**/, _loop_1(assignment)];
                case 16:
                    _m.sent();
                    _m.label = 17;
                case 17:
                    _i++;
                    return [3 /*break*/, 15];
                case 18: return [4 /*yield*/, store.updateTask(input.taskId, function (currentTask) { return (__assign(__assign({}, currentTask), { status: completedOrFailed.status === 'completed' ? 'completed' : 'failed', updatedAt: new Date().toISOString() })); })];
                case 19:
                    task = _m.sent();
                    return [2 /*return*/, __assign({ execution: completedOrFailed, task: task }, (finalizedWorkflowArtifacts
                            ? {
                                workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
                                assignments: finalizedWorkflowArtifacts.assignments,
                            }
                            : {}))];
            }
        });
    });
}
function beginExecution(input) {
    return __assign(__assign({ id: (0, node_crypto_1.randomUUID)(), taskId: input.taskId, status: 'pending', executor: input.executor, runtimeName: input.runtimeName || (0, runtime_adapter_1.resolveRuntimeName)(input.executor), degraded: Boolean(input.degraded), timeoutMs: input.timeoutMs, maxRetries: input.maxRetries, retryCount: 0, inputSnapshot: input.inputSnapshot, memoryContextExcerpt: input.memoryContextExcerpt, startedAt: new Date().toISOString() }, (input.workflowPlan ? { workflowPlan: input.workflowPlan } : {})), (input.assignments ? { assignments: input.assignments } : {}));
}
function completeExecution(execution, input) {
    var _a, _b, _c, _d;
    return __assign(__assign(__assign(__assign({}, execution), { status: 'completed', outputSummary: input.summary, outputSnapshot: input.outputSnapshot, retryCount: (_a = input.retryCount) !== null && _a !== void 0 ? _a : execution.retryCount, maxRetries: (_b = input.maxRetries) !== null && _b !== void 0 ? _b : execution.maxRetries, timeoutMs: (_c = input.timeoutMs) !== null && _c !== void 0 ? _c : execution.timeoutMs, degraded: (_d = input.degraded) !== null && _d !== void 0 ? _d : execution.degraded, endedAt: new Date().toISOString(), completedAt: new Date().toISOString() }), (input.workflowPlan ? { workflowPlan: input.workflowPlan } : {})), (input.assignments ? { assignments: input.assignments } : {}));
}
function failExecution(execution, input) {
    var _a, _b, _c, _d;
    return __assign(__assign({}, execution), { status: 'failed', errorMessage: input.errorMessage, retryCount: (_a = input.retryCount) !== null && _a !== void 0 ? _a : execution.retryCount, maxRetries: (_b = input.maxRetries) !== null && _b !== void 0 ? _b : execution.maxRetries, timeoutMs: (_c = input.timeoutMs) !== null && _c !== void 0 ? _c : execution.timeoutMs, degraded: (_d = input.degraded) !== null && _d !== void 0 ? _d : execution.degraded, structuredError: input.structuredError
            ? {
                code: input.structuredError.code,
                message: input.structuredError.message,
                retriable: input.structuredError.retriable,
                details: input.structuredError.details,
            }
            : execution.structuredError, endedAt: new Date().toISOString(), completedAt: new Date().toISOString() });
}
function withTimeout(promise, timeoutMs) {
    if (timeoutMs <= 0) {
        return promise;
    }
    return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () {
            reject(new Error("Execution timed out after ".concat(timeoutMs, "ms")));
        }, timeoutMs);
        promise.then(function (value) {
            clearTimeout(timeout);
            resolve(value);
        }, function (error) {
            clearTimeout(timeout);
            reject(error);
        });
    });
}
function toRuntimeError(error, timeoutMs) {
    var message = error instanceof Error ? error.message : 'Unknown runtime failure';
    if (message.includes('timed out')) {
        return {
            code: 'timeout',
            message: message,
            retriable: true,
            details: { timeoutMs: timeoutMs },
        };
    }
    return {
        code: 'execution_failed',
        message: message,
        retriable: false,
    };
}
