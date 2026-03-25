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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = getCurrentUser;
exports.filterAgentsByUser = filterAgentsByUser;
exports.checkAccess = checkAccess;
var node_fs_1 = __importDefault(require("node:fs"));
var node_path_1 = __importDefault(require("node:path"));
var node_os_1 = __importDefault(require("node:os"));
function getCurrentUser() {
    var homeDir = process.env.HOME || node_os_1.default.homedir();
    var userJsonPath = node_path_1.default.join(homeDir, '.ai', 'user.json');
    if (node_fs_1.default.existsSync(userJsonPath)) {
        try {
            var userContent = node_fs_1.default.readFileSync(userJsonPath, 'utf8');
            var userConfig = JSON.parse(userContent);
            return {
                id: userConfig.id || 'unknown',
                name: userConfig.name || 'Unknown User',
                homeDir: homeDir,
                accessLevel: validateAccessLevel(userConfig.accessLevel),
                customPermissions: userConfig.customPermissions || [],
            };
        }
        catch (error) {
            console.warn('Failed to parse user.json, falling back to environment:', error);
        }
    }
    var userId = process.env.USER || process.env.USERNAME || 'anonymous';
    var accessLevel = validateAccessLevel(process.env.AGENT_ACCESS_LEVEL);
    return {
        id: userId,
        name: userId === 'anonymous' ? 'Anonymous User' : userId,
        homeDir: homeDir,
        accessLevel: accessLevel,
    };
}
function validateAccessLevel(level) {
    var validLevels = ['full', 'readonly', 'limited', 'admin'];
    if (level && validLevels.includes(level)) {
        return level;
    }
    return 'full';
}
function filterAgentsByUser(agents, user) {
    if (agents.length === 0) {
        return [];
    }
    if (user.accessLevel === 'full' || user.accessLevel === 'admin') {
        return agents.map(function (agent) { return (__assign(__assign({}, agent), { access: agent.access || 'public', readonly: user.accessLevel === 'readonly' })); });
    }
    return agents.filter(function (agent) {
        var _a, _b;
        var agentAccess = agent.access || 'public';
        if (user.customPermissions && user.customPermissions.includes(agent.id)) {
            return true;
        }
        if ((_a = agent.metadata) === null || _a === void 0 ? void 0 : _a.requiredPermission) {
            return (_b = user.customPermissions) === null || _b === void 0 ? void 0 : _b.includes(agent.metadata.requiredPermission);
        }
        switch (user.accessLevel) {
            case 'limited':
                return agentAccess === 'public';
            case 'readonly':
                return agentAccess === 'public' || agentAccess === 'internal';
            default:
                return false;
        }
    }).map(function (agent) { return ({
        id: agent.id,
        name: agent.name,
        access: agent.access || 'public',
        readonly: user.accessLevel === 'readonly',
    }); });
}
function checkAccess(user, resourceLevel, operation) {
    if (user.accessLevel === 'full' || user.accessLevel === 'admin') {
        return true;
    }
    if (operation === 'write' && (user.accessLevel === 'readonly' || user.accessLevel === 'limited')) {
        return false;
    }
    if (user.customPermissions && user.customPermissions.length > 0) {
        if (user.customPermissions.includes("".concat(resourceLevel, "-read")) ||
            user.customPermissions.includes("".concat(resourceLevel, "-write")) ||
            user.customPermissions.includes(resourceLevel)) {
            return true;
        }
    }
    switch (user.accessLevel) {
        case 'limited':
            return resourceLevel === 'public';
        case 'readonly':
            return resourceLevel === 'public' || resourceLevel === 'internal';
        default:
            return false;
    }
}
