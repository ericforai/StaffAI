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
exports.initializeAiDirectory = initializeAiDirectory;
exports.createDirectoryStructure = createDirectoryStructure;
exports.generateTemplateFiles = generateTemplateFiles;
exports.verifyDirectoryStructure = verifyDirectoryStructure;
var node_fs_1 = __importDefault(require("node:fs"));
var node_path_1 = __importDefault(require("node:path"));
function initializeAiDirectory(options) {
    var rootDir = options.rootDir, _a = options.force, force = _a === void 0 ? false : _a, _b = options.templates, templates = _b === void 0 ? true : _b, _c = options.customDirs, customDirs = _c === void 0 ? [] : _c, _d = options.customTemplates, customTemplates = _d === void 0 ? {} : _d;
    var aiDir = node_path_1.default.join(rootDir, '.ai');
    try {
        if (node_fs_1.default.existsSync(aiDir)) {
            if (!force) {
                return {
                    success: true,
                    aiDir: aiDir,
                    created: [],
                };
            }
            node_fs_1.default.rmSync(aiDir, { recursive: true, force: true });
        }
        node_fs_1.default.mkdirSync(aiDir, { recursive: true });
        var created = createDirectoryStructure(aiDir, customDirs);
        if (templates) {
            generateTemplateFiles(aiDir, customTemplates);
        }
        return {
            success: true,
            aiDir: aiDir,
            created: created,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            created: [],
        };
    }
}
function createDirectoryStructure(aiDir, customDirs) {
    if (customDirs === void 0) { customDirs = []; }
    var standardDirs = [
        'notes',
        'decisions',
        'playbooks',
        'agents',
        'meetings',
        'task-summaries',
        'knowledge',
    ];
    var allDirs = __spreadArray(__spreadArray([], standardDirs, true), customDirs, true);
    var created = [];
    for (var _i = 0, allDirs_1 = allDirs; _i < allDirs_1.length; _i++) {
        var dir = allDirs_1[_i];
        var dirPath = node_path_1.default.join(aiDir, dir);
        if (!node_fs_1.default.existsSync(dirPath)) {
            node_fs_1.default.mkdirSync(dirPath, { recursive: true });
            created.push(dir);
        }
    }
    return created;
}
function generateTemplateFiles(aiDir, customTemplates) {
    if (customTemplates === void 0) { customTemplates = {}; }
    var normalizedCustomTemplates = {};
    for (var _i = 0, _a = Object.entries(customTemplates); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (!key.includes('/')) {
            normalizedCustomTemplates["".concat(key, "/_template.md")] = value;
        }
        else {
            normalizedCustomTemplates[key] = value;
        }
    }
    var defaultTemplates = {
        'notes/_template.md': "# Note Template\n\n## Date\n{{date}}\n\n## Topic\n{{topic}}\n\n## Notes\n<!-- Your notes here -->\n\n## Tags\n<!-- Add tags for easy searching -->\n",
        'decisions/_template.md': "# Decision Record\n\n## Date\n{{date}}\n\n## Decision\n<!-- Brief description of the decision -->\n\n## Context\n<!-- Background and context -->\n\n## Options Considered\n1. Option A\n2. Option B\n3. Option C\n\n## Decision Outcome\n<!-- Which option was chosen and why -->\n\n## Consequences\n<!-- Positive and negative consequences -->\n\n## Tags\n<!-- decision-log, architecture, etc. -->\n",
        'playbooks/_template.md': "# Playbook\n\n## Purpose\n<!-- What this playbook achieves -->\n\n## Prerequisites\n<!-- What needs to be in place -->\n\n## Steps\n1. Step one\n2. Step two\n3. Step three\n\n## Troubleshooting\n<!-- Common issues and solutions -->\n\n## Related Resources\n<!-- Links to related documentation -->\n",
        'meetings/_template.md': "# Meeting Notes\n\n## Date\n{{date}}\n\n## Attendees\n<!-- List of attendees -->\n\n## Agenda\n1. Item one\n2. Item two\n3. Item three\n\n## Discussion\n<!-- Key discussion points -->\n\n## Action Items\n- [ ] Action item 1\n- [ ] Action item 2\n\n## Next Steps\n<!-- What happens next -->\n",
    };
    var mergedTemplates = __assign(__assign({}, defaultTemplates), normalizedCustomTemplates);
    for (var _c = 0, _d = Object.entries(mergedTemplates); _c < _d.length; _c++) {
        var _e = _d[_c], relativePath = _e[0], content = _e[1];
        var filePath = node_path_1.default.join(aiDir, relativePath);
        var dir = node_path_1.default.dirname(filePath);
        if (!node_fs_1.default.existsSync(dir)) {
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
        if (!node_fs_1.default.existsSync(filePath)) {
            node_fs_1.default.writeFileSync(filePath, content, 'utf8');
        }
    }
    var emptyDirs = ['agents', 'meetings', 'task-summaries', 'knowledge'];
    for (var _f = 0, emptyDirs_1 = emptyDirs; _f < emptyDirs_1.length; _f++) {
        var dir = emptyDirs_1[_f];
        var dirPath = node_path_1.default.join(aiDir, dir);
        if (node_fs_1.default.existsSync(dirPath)) {
            var gitkeepPath = node_path_1.default.join(dirPath, '.gitkeep');
            if (!node_fs_1.default.existsSync(gitkeepPath)) {
                node_fs_1.default.writeFileSync(gitkeepPath, '', 'utf8');
            }
        }
    }
    var readmePath = node_path_1.default.join(aiDir, 'README.md');
    if (!node_fs_1.default.existsSync(readmePath)) {
        var readmeContent = "# AI Memory & Knowledge\n\nThis directory stores persistent memory and knowledge for the AI system.\n\n## Directory Structure\n\n- `notes/` - General notes and observations\n- `decisions/` - Architectural and technical decisions\n- `playbooks/` - Standard operating procedures\n- `agents/` - Agent-specific knowledge\n- `meetings/` - Meeting notes and summaries\n- `task-summaries/` - Execution summaries and outcomes\n- `knowledge/` - General knowledge base\n\n## Usage\n\nThis directory is automatically indexed and searchable by the memory retrieval system.\n\n## Configuration\n\nCopy `user.json.example` to `user.json` and customize for your environment.\n";
        node_fs_1.default.writeFileSync(readmePath, readmeContent, 'utf8');
    }
    var userJsonExamplePath = node_path_1.default.join(aiDir, 'user.json.example');
    if (!node_fs_1.default.existsSync(userJsonExamplePath)) {
        var userJsonExample = {
            id: 'your-user-id',
            name: 'Your Name',
            email: 'your.email@example.com',
            accessLevel: 'full',
            customPermissions: [],
        };
        node_fs_1.default.writeFileSync(userJsonExamplePath, JSON.stringify(userJsonExample, null, 2), 'utf8');
    }
    var gitignorePath = node_path_1.default.join(aiDir, '.gitignore');
    if (!node_fs_1.default.existsSync(gitignorePath)) {
        var gitignoreContent = "# User-specific configuration\nuser.json\n\n# Log files\n*.log\n\n# Temporary files\n*.tmp\n*.temp\n\n# OS files\n.DS_Store\nThumbs.db\n";
        node_fs_1.default.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    }
}
function verifyDirectoryStructure(aiDir, options) {
    if (options === void 0) { options = {}; }
    var requiredDirs = [
        'notes',
        'decisions',
        'playbooks',
        'agents',
        'meetings',
        'task-summaries',
        'knowledge',
    ];
    var missing = [];
    if (!node_fs_1.default.existsSync(aiDir)) {
        return {
            valid: false,
            missing: requiredDirs,
        };
    }
    for (var _i = 0, requiredDirs_1 = requiredDirs; _i < requiredDirs_1.length; _i++) {
        var dir = requiredDirs_1[_i];
        var dirPath = node_path_1.default.join(aiDir, dir);
        if (!node_fs_1.default.existsSync(dirPath)) {
            missing.push(dir);
        }
    }
    if (options.checkTemplates) {
        var templateFiles = [
            'notes/_template.md',
            'decisions/_template.md',
            'playbooks/_template.md',
            'meetings/_template.md',
        ];
        for (var _a = 0, templateFiles_1 = templateFiles; _a < templateFiles_1.length; _a++) {
            var templateFile = templateFiles_1[_a];
            var templatePath = node_path_1.default.join(aiDir, templateFile);
            if (!node_fs_1.default.existsSync(templatePath)) {
                missing.push(templateFile);
            }
        }
    }
    return {
        valid: missing.length === 0,
        missing: missing,
    };
}
