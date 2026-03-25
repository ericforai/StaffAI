"use strict";
/**
 * Memory Initializer
 *
 * Asynchronous initializer for the .ai/ memory directory structure.
 * Ensures all required directories and template files exist on startup.
 *
 * @module memory/memory-initializer
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
exports.initializeMemoryLayout = initializeMemoryLayout;
exports.isMemoryLayoutInitialized = isMemoryLayoutInitialized;
exports.getMemoryDirectory = getMemoryDirectory;
exports.validateMemoryLayout = validateMemoryLayout;
exports.destroyMemoryLayout = destroyMemoryLayout;
var fs_1 = require("fs");
var node_path_1 = __importDefault(require("node:path"));
var memory_layout_1 = require("./memory-layout");
/**
 * Initializes the .ai/ directory structure with all required subdirectories
 * and template files.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns The directory layout object with all paths
 * @throws Error if directory creation fails
 *
 * @example
 * ```ts
 * const layout = await initializeMemoryLayout('/path/to/.ai');
 * console.log('Memory initialized at', layout.memoryRootDir);
 * ```
 */
function initializeMemoryLayout(memoryRootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var layout, _i, MEMORY_SUBDIRS_1, subdir, dirPath, projectContextPath, currentTaskPath, emptyDirs, _a, emptyDirs_1, dir, gitkeepPath, _b, readmePath, _c, gitignorePath, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    layout = (0, memory_layout_1.createMemoryLayout)(memoryRootDir);
                    // Create the root directory
                    return [4 /*yield*/, fs_1.promises.mkdir(memoryRootDir, { recursive: true })];
                case 1:
                    // Create the root directory
                    _e.sent();
                    _i = 0, MEMORY_SUBDIRS_1 = memory_layout_1.MEMORY_SUBDIRS;
                    _e.label = 2;
                case 2:
                    if (!(_i < MEMORY_SUBDIRS_1.length)) return [3 /*break*/, 5];
                    subdir = MEMORY_SUBDIRS_1[_i];
                    dirPath = node_path_1.default.join(memoryRootDir, subdir);
                    return [4 /*yield*/, fs_1.promises.mkdir(dirPath, { recursive: true })];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    projectContextPath = node_path_1.default.join(layout.contextDir, memory_layout_1.MEMORY_FILE_NAMES.PROJECT_CONTEXT);
                    return [4 /*yield*/, ensureTemplateFile(projectContextPath, (0, memory_layout_1.formatTemplate)(memory_layout_1.PROJECT_TEMPLATE))];
                case 6:
                    _e.sent();
                    currentTaskPath = node_path_1.default.join(layout.contextDir, memory_layout_1.MEMORY_FILE_NAMES.CURRENT_TASK);
                    return [4 /*yield*/, ensureTemplateFile(currentTaskPath, (0, memory_layout_1.formatTemplate)(memory_layout_1.CURRENT_TASK_TEMPLATE))];
                case 7:
                    _e.sent();
                    emptyDirs = [layout.agentsDir, layout.taskSummariesDir];
                    _a = 0, emptyDirs_1 = emptyDirs;
                    _e.label = 8;
                case 8:
                    if (!(_a < emptyDirs_1.length)) return [3 /*break*/, 14];
                    dir = emptyDirs_1[_a];
                    gitkeepPath = node_path_1.default.join(dir, '.gitkeep');
                    _e.label = 9;
                case 9:
                    _e.trys.push([9, 11, , 13]);
                    return [4 /*yield*/, fs_1.promises.access(gitkeepPath)];
                case 10:
                    _e.sent();
                    return [3 /*break*/, 13];
                case 11:
                    _b = _e.sent();
                    return [4 /*yield*/, fs_1.promises.writeFile(gitkeepPath, '', 'utf8')];
                case 12:
                    _e.sent();
                    return [3 /*break*/, 13];
                case 13:
                    _a++;
                    return [3 /*break*/, 8];
                case 14:
                    readmePath = node_path_1.default.join(memoryRootDir, 'README.md');
                    _e.label = 15;
                case 15:
                    _e.trys.push([15, 17, , 19]);
                    return [4 /*yield*/, fs_1.promises.access(readmePath)];
                case 16:
                    _e.sent();
                    return [3 /*break*/, 19];
                case 17:
                    _c = _e.sent();
                    return [4 /*yield*/, fs_1.promises.writeFile(readmePath, "# AI Memory & Knowledge\n\nThis directory stores persistent memory and knowledge for the AI system.\n\n## Directory Structure\n\n- `context/` - Project context and current task tracking\n- `tasks/` - Task-specific documentation and notes\n- `decisions/` - Architectural and technical decision records\n- `knowledge/` - General knowledge base articles\n- `agents/` - Agent-specific memory and preferences\n- `task-summaries/` - Execution summaries and outcomes\n\n## Usage\n\nThis directory is automatically indexed and searchable by the memory retrieval system.\nDocuments are organized by type for efficient retrieval.\n\n## Configuration\n\nThe memory directory location can be configured via the `AGENCY_MEMORY_DIR` environment variable.\n", 'utf8')];
                case 18:
                    _e.sent();
                    return [3 /*break*/, 19];
                case 19:
                    gitignorePath = node_path_1.default.join(memoryRootDir, '.gitignore');
                    _e.label = 20;
                case 20:
                    _e.trys.push([20, 22, , 24]);
                    return [4 /*yield*/, fs_1.promises.access(gitignorePath)];
                case 21:
                    _e.sent();
                    return [3 /*break*/, 24];
                case 22:
                    _d = _e.sent();
                    return [4 /*yield*/, fs_1.promises.writeFile(gitignorePath, "# User-specific configuration\nuser.json\n\n# Log files\n*.log\n\n# Temporary files\n*.tmp\n*.temp\n\n# OS files\n.DS_Store\nThumbs.db\n", 'utf8')];
                case 23:
                    _e.sent();
                    return [3 /*break*/, 24];
                case 24: return [2 /*return*/, layout];
            }
        });
    });
}
/**
 * Ensures a template file exists, creating it if missing.
 * Does not overwrite existing files.
 *
 * @param filePath - Absolute path to the template file
 * @param content - Template content to write if file doesn't exist
 */
function ensureTemplateFile(filePath, content) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 4]);
                    return [4 /*yield*/, fs_1.promises.access(filePath)];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 2:
                    _a = _b.sent();
                    // File doesn't exist, create it
                    return [4 /*yield*/, fs_1.promises.writeFile(filePath, content, 'utf8')];
                case 3:
                    // File doesn't exist, create it
                    _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Checks if the .ai/ directory structure has been initialized.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns true if the directory structure exists and is complete
 *
 * @example
 * ```ts
 * if (!await isMemoryLayoutInitialized('/path/to/.ai')) {
 *   await initializeMemoryLayout('/path/to/.ai');
 * }
 * ```
 */
function isMemoryLayoutInitialized(memoryRootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var layout, requiredDirs, _i, requiredDirs_1, dir, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    // Check if root directory exists
                    return [4 /*yield*/, fs_1.promises.access(memoryRootDir)];
                case 1:
                    // Check if root directory exists
                    _b.sent();
                    layout = (0, memory_layout_1.createMemoryLayout)(memoryRootDir);
                    requiredDirs = [
                        layout.contextDir,
                        layout.tasksDir,
                        layout.decisionsDir,
                        layout.knowledgeDir,
                        layout.agentsDir,
                        layout.taskSummariesDir,
                    ];
                    _i = 0, requiredDirs_1 = requiredDirs;
                    _b.label = 2;
                case 2:
                    if (!(_i < requiredDirs_1.length)) return [3 /*break*/, 5];
                    dir = requiredDirs_1[_i];
                    return [4 /*yield*/, fs_1.promises.access(dir)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, true];
                case 6:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Gets the current memory directory from environment or default.
 *
 * @param fallbackDir - Fallback directory if AGENCY_MEMORY_DIR is not set
 * @returns The memory directory path
 */
function getMemoryDirectory(fallbackDir) {
    if (fallbackDir === void 0) { fallbackDir = '.ai'; }
    var envDir = process.env.AGENCY_MEMORY_DIR;
    if (envDir && envDir.trim().length > 0) {
        return node_path_1.default.resolve(envDir);
    }
    return node_path_1.default.resolve(process.cwd(), fallbackDir);
}
/**
 * Validates that the memory directory structure is complete.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns Object with validation result and any missing items
 */
function validateMemoryLayout(memoryRootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var missing, layout, _a, dirsToCheck, _i, dirsToCheck_1, _b, name_1, dirPath, _c, templateFiles, _d, templateFiles_1, _e, name_2, filePath, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    missing = [];
                    layout = (0, memory_layout_1.createMemoryLayout)(memoryRootDir);
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fs_1.promises.access(layout.memoryRootDir)];
                case 2:
                    _g.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _g.sent();
                    missing.push('<root>');
                    return [3 /*break*/, 4];
                case 4:
                    dirsToCheck = [
                        { name: 'context', dirPath: layout.contextDir },
                        { name: 'tasks', dirPath: layout.tasksDir },
                        { name: 'decisions', dirPath: layout.decisionsDir },
                        { name: 'knowledge', dirPath: layout.knowledgeDir },
                        { name: 'agents', dirPath: layout.agentsDir },
                        { name: 'task-summaries', dirPath: layout.taskSummariesDir },
                    ];
                    _i = 0, dirsToCheck_1 = dirsToCheck;
                    _g.label = 5;
                case 5:
                    if (!(_i < dirsToCheck_1.length)) return [3 /*break*/, 10];
                    _b = dirsToCheck_1[_i], name_1 = _b.name, dirPath = _b.dirPath;
                    _g.label = 6;
                case 6:
                    _g.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, fs_1.promises.access(dirPath)];
                case 7:
                    _g.sent();
                    return [3 /*break*/, 9];
                case 8:
                    _c = _g.sent();
                    missing.push(name_1);
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 5];
                case 10:
                    templateFiles = [
                        { name: 'context/project.md', filePath: node_path_1.default.join(layout.contextDir, memory_layout_1.MEMORY_FILE_NAMES.PROJECT_CONTEXT) },
                        { name: 'context/current-task.md', filePath: node_path_1.default.join(layout.contextDir, memory_layout_1.MEMORY_FILE_NAMES.CURRENT_TASK) },
                    ];
                    _d = 0, templateFiles_1 = templateFiles;
                    _g.label = 11;
                case 11:
                    if (!(_d < templateFiles_1.length)) return [3 /*break*/, 16];
                    _e = templateFiles_1[_d], name_2 = _e.name, filePath = _e.filePath;
                    _g.label = 12;
                case 12:
                    _g.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, fs_1.promises.access(filePath)];
                case 13:
                    _g.sent();
                    return [3 /*break*/, 15];
                case 14:
                    _f = _g.sent();
                    missing.push(name_2);
                    return [3 /*break*/, 15];
                case 15:
                    _d++;
                    return [3 /*break*/, 11];
                case 16: return [2 /*return*/, {
                        valid: missing.length === 0,
                        missing: missing,
                    }];
            }
        });
    });
}
/**
 * Removes the .ai/ directory structure entirely.
 * Use with caution - this deletes all memory data.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns true if successfully removed
 */
function destroyMemoryLayout(memoryRootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.promises.rm(memoryRootDir, { recursive: true, force: true })];
                case 1:
                    _b.sent();
                    return [2 /*return*/, true];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
