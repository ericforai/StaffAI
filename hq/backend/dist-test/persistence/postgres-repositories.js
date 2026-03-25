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
exports.createPostgresTaskRepository = createPostgresTaskRepository;
exports.createPostgresApprovalRepository = createPostgresApprovalRepository;
exports.createPostgresExecutionRepository = createPostgresExecutionRepository;
var pg_1 = require("pg");
var SHARED_POOLS = new Map();
function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
}
function parseInteger(raw) {
    if (!raw)
        return undefined;
    var value = Number.parseInt(raw, 10);
    return Number.isNaN(value) ? undefined : value;
}
function parseSslSetting(raw) {
    if (!raw)
        return undefined;
    var normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'require') {
        return { rejectUnauthorized: false };
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'disable') {
        return false;
    }
    return undefined;
}
function normalizeIdentifier(identifier, label) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error("Invalid postgres identifier for ".concat(label, ": ").concat(identifier));
    }
    return identifier;
}
function quoteIdentifier(identifier) {
    return "\"".concat(identifier, "\"");
}
function qualifyTable(schema, table) {
    return "".concat(quoteIdentifier(schema), ".").concat(quoteIdentifier(table));
}
function getPoolKey(options, ssl) {
    var _a, _b, _c;
    var sslKey = typeof ssl === 'object' && ssl !== null ? JSON.stringify({ rejectUnauthorized: ssl.rejectUnauthorized }) : String(ssl);
    return [
        options.connectionString,
        (_a = options.poolMax) !== null && _a !== void 0 ? _a : parseInteger(process.env.AGENCY_POSTGRES_POOL_MAX),
        (_b = options.idleTimeoutMs) !== null && _b !== void 0 ? _b : parseInteger(process.env.AGENCY_POSTGRES_IDLE_TIMEOUT_MS),
        (_c = options.connectionTimeoutMs) !== null && _c !== void 0 ? _c : parseInteger(process.env.AGENCY_POSTGRES_CONNECTION_TIMEOUT_MS),
        sslKey,
    ].join('|');
}
function resolveRuntime(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var schema = normalizeIdentifier((_b = (_a = options.schema) !== null && _a !== void 0 ? _a : process.env.AGENCY_POSTGRES_SCHEMA) !== null && _b !== void 0 ? _b : 'public', 'schema');
    var taskTable = normalizeIdentifier((_d = (_c = options.taskTable) !== null && _c !== void 0 ? _c : process.env.AGENCY_POSTGRES_TASKS_TABLE) !== null && _d !== void 0 ? _d : 'tasks', 'task table');
    var approvalTable = normalizeIdentifier((_f = (_e = options.approvalTable) !== null && _e !== void 0 ? _e : process.env.AGENCY_POSTGRES_APPROVALS_TABLE) !== null && _f !== void 0 ? _f : 'approvals', 'approval table');
    var executionTable = normalizeIdentifier((_h = (_g = options.executionTable) !== null && _g !== void 0 ? _g : process.env.AGENCY_POSTGRES_EXECUTIONS_TABLE) !== null && _h !== void 0 ? _h : 'executions', 'execution table');
    var ssl = (_j = options.ssl) !== null && _j !== void 0 ? _j : parseSslSetting(process.env.AGENCY_POSTGRES_SSL);
    var poolKey = getPoolKey(options, ssl);
    var existingPool = SHARED_POOLS.get(poolKey);
    if (existingPool) {
        return { client: existingPool, schema: schema, taskTable: taskTable, approvalTable: approvalTable, executionTable: executionTable };
    }
    var pool = new pg_1.Pool({
        connectionString: options.connectionString,
        max: (_k = options.poolMax) !== null && _k !== void 0 ? _k : parseInteger(process.env.AGENCY_POSTGRES_POOL_MAX),
        idleTimeoutMillis: (_l = options.idleTimeoutMs) !== null && _l !== void 0 ? _l : parseInteger(process.env.AGENCY_POSTGRES_IDLE_TIMEOUT_MS),
        connectionTimeoutMillis: (_m = options.connectionTimeoutMs) !== null && _m !== void 0 ? _m : parseInteger(process.env.AGENCY_POSTGRES_CONNECTION_TIMEOUT_MS),
        ssl: ssl,
    });
    SHARED_POOLS.set(poolKey, pool);
    return { client: pool, schema: schema, taskTable: taskTable, approvalTable: approvalTable, executionTable: executionTable };
}
function createBootstrapper(client, tableName, tableLabel, includesTaskLookupIndex) {
    var _this = this;
    var bootstrapPromise = null;
    return function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!bootstrapPromise) {
                        bootstrapPromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, client.query("CREATE TABLE IF NOT EXISTS ".concat(tableName, " (\n            id TEXT PRIMARY KEY,\n            payload JSONB NOT NULL,\n            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n          )"))];
                                    case 1:
                                        _a.sent();
                                        if (!includesTaskLookupIndex) return [3 /*break*/, 3];
                                        return [4 /*yield*/, client.query("CREATE INDEX IF NOT EXISTS ".concat(quoteIdentifier("".concat(tableLabel, "_task_id_idx")), "\n             ON ").concat(tableName, " ((payload->>'taskId'))"))];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })();
                    }
                    return [4 /*yield*/, bootstrapPromise];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
function listRecords(client, tableName) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.query("SELECT payload FROM ".concat(tableName, " ORDER BY updated_at ASC"))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) { return cloneRecord(row.payload); })];
            }
        });
    });
}
function getRecordById(client, tableName, id) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.query("SELECT payload FROM ".concat(tableName, " WHERE id = $1 LIMIT 1"), [id])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows[0] ? cloneRecord(result.rows[0].payload) : null];
            }
        });
    });
}
function listRecordsByTaskId(client, tableName, taskId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.query("SELECT payload FROM ".concat(tableName, " WHERE payload->>'taskId' = $1 ORDER BY updated_at ASC"), [taskId])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) { return cloneRecord(row.payload); })];
            }
        });
    });
}
function upsertRecord(client, tableName, record) {
    return __awaiter(this, void 0, void 0, function () {
        var payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = JSON.stringify(record);
                    return [4 /*yield*/, client.query("INSERT INTO ".concat(tableName, " (id, payload, updated_at)\n     VALUES ($1, $2::jsonb, NOW())\n     ON CONFLICT (id) DO UPDATE SET\n       payload = EXCLUDED.payload,\n       updated_at = NOW()"), [record.id, payload])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createPostgresTaskRepository(options) {
    var runtime = resolveRuntime(options);
    var tableName = qualifyTable(runtime.schema, runtime.taskTable);
    var ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.taskTable, false);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, listRecords(runtime.client, tableName)];
                    }
                });
            });
        },
        getById: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, getRecordById(runtime.client, tableName, taskId)];
                    }
                });
            });
        },
        save: function (task) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, upsertRecord(runtime.client, tableName, task)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (taskId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var current, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, getRecordById(runtime.client, tableName, taskId)];
                        case 2:
                            current = _a.sent();
                            if (!current) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(current);
                            return [4 /*yield*/, upsertRecord(runtime.client, tableName, updated)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, cloneRecord(updated)];
                    }
                });
            });
        },
    };
}
function createPostgresApprovalRepository(options) {
    var runtime = resolveRuntime(options);
    var tableName = qualifyTable(runtime.schema, runtime.approvalTable);
    var ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.approvalTable, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, listRecords(runtime.client, tableName)];
                    }
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, listRecordsByTaskId(runtime.client, tableName, taskId)];
                    }
                });
            });
        },
        save: function (approval) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, upsertRecord(runtime.client, tableName, approval)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        updateStatus: function (approvalId, status) {
            return __awaiter(this, void 0, void 0, function () {
                var current, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, getRecordById(runtime.client, tableName, approvalId)];
                        case 2:
                            current = _a.sent();
                            if (!current) {
                                return [2 /*return*/, null];
                            }
                            updated = __assign(__assign({}, current), { status: status, resolvedAt: new Date().toISOString() });
                            return [4 /*yield*/, upsertRecord(runtime.client, tableName, updated)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, cloneRecord(updated)];
                    }
                });
            });
        },
    };
}
function createPostgresExecutionRepository(options) {
    var runtime = resolveRuntime(options);
    var tableName = qualifyTable(runtime.schema, runtime.executionTable);
    var ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.executionTable, true);
    return {
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, listRecords(runtime.client, tableName)];
                    }
                });
            });
        },
        getById: function (executionId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, getRecordById(runtime.client, tableName, executionId)];
                    }
                });
            });
        },
        listByTaskId: function (taskId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, listRecordsByTaskId(runtime.client, tableName, taskId)];
                    }
                });
            });
        },
        save: function (execution) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, upsertRecord(runtime.client, tableName, execution)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        update: function (executionId, updater) {
            return __awaiter(this, void 0, void 0, function () {
                var current, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ensureBootstrapped()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, getRecordById(runtime.client, tableName, executionId)];
                        case 2:
                            current = _a.sent();
                            if (!current) {
                                return [2 /*return*/, null];
                            }
                            updated = updater(current);
                            return [4 /*yield*/, upsertRecord(runtime.client, tableName, updated)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, cloneRecord(updated)];
                    }
                });
            });
        },
    };
}
