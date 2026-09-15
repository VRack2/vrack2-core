"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ErrorManager_1 = __importDefault(require("./errors/ErrorManager"));
const Rule_1 = __importDefault(require("./validator/Rule"));
ErrorManager_1.default.registerMany('ImportManager', [
    {
        short: 'IM_FILE_NOT_FOUND',
        description: 'Import file not found',
        rules: { filePath: Rule_1.default.string().description('Path to file') }
    },
    {
        short: 'IM_JSON_INCORRECT',
        description: 'Import file json incorrect',
        rules: {
            jsonRaw: Rule_1.default.string().description('Raw json data'),
            parsingError: Rule_1.default.string().description('Json parse error string')
        }
    },
    {
        short: 'IM_CLASS_PATH_ERROR',
        description: 'Error import class - No acts',
        rules: { path: Rule_1.default.string().description('Class path string') }
    },
    {
        short: 'IM_CLASS_VENDOR_ERROR',
        description: 'Error import class - vendor not found',
        rules: { path: Rule_1.default.string().description('Class path string') }
    },
    {
        short: 'IM_CLASS_ACT_ERROR',
        description: 'Error import class - class act = undefined',
        rules: { path: Rule_1.default.string().description('Class path string') }
    },
]);
class ImportManager {
    /**
     * Dynamic import method
     *
     * @param {string} path Full or relative path to file
    */
    static async importPath(raPath) {
        // IF we have absolute path
        if (path_1.default.isAbsolute(raPath)) {
            const ti = await ImportManager.tryImport(raPath);
            if (ti !== false)
                return ti;
        }
        const mbfp = path_1.default.join(ImportManager.systemPath(), raPath);
        if ((0, fs_1.existsSync)(mbfp)) {
            const ti = await ImportManager.tryImport(raPath);
            if (ti !== false)
                return ti;
        }
        const ti = await Promise.resolve(`${raPath}`).then(s => __importStar(require(s)));
        return ti;
    }
    /**
     * Import class like a vrack2 device style
     *
     * Разделяет переданную строку пути на части.
     * Первая часть является названием модуля, а следующие части —
     * путём к вложенному классу внутри него
     *
     * @example ImportManager.importClass('vrack2-core.Container')
    */
    static async importClass(cs) {
        const acts = cs.split('.');
        const vendor = acts.shift();
        if (typeof vendor !== 'string')
            throw ErrorManager_1.default.make('IM_CLASS_PATH_ERROR', { path: cs });
        let ret = await ImportManager.tryImport(vendor);
        if (ret === false)
            throw ErrorManager_1.default.make('IM_CLASS_VENDOR_ERROR', { path: cs });
        for (const act of acts) {
            ret = ret[act];
            if (ret === undefined)
                throw ErrorManager_1.default.make('IM_CLASS_ACT_ERROR', { path: cs });
        }
        return ret;
    }
    /**
     * Attempts to open a file and use its contents as json
     *
     * Returns the result of parsing json
     *
     * @returns {any} json parsing result
    */
    static importJSON(filePath) {
        if (!path_1.default.isAbsolute(filePath)) {
            filePath = path_1.default.join(ImportManager.systemPath(), filePath);
        }
        if ((0, fs_1.existsSync)(filePath)) {
            const jdata = (0, fs_1.readFileSync)(filePath).toString('utf-8');
            return ImportManager.tryJsonParse(jdata);
        }
        throw ErrorManager_1.default.make('IM_FILE_NOT_FOUND', { filePath });
    }
    /**
     * Returns the class name in the style of import vrack
     *
     * return `Container` from 'vrack2-core.Container' string
     *
     * @param cs Import class string
     *
    */
    static importClassName(cs) {
        const acts = cs.split('.');
        return acts.pop();
    }
    /**
     * Returns the vendor name in the style of import vrack
     *
     * return `vrack2-core` from 'vrack2-core.Container' string
     *
     * @param cs Import class string
    */
    static importVendorName(cs) {
        const acts = cs.split('.');
        return acts.shift();
    }
    /**
     * Returns a list of directories in the specified directory.
     *
     * @param dir path to directory
     */
    static dirList(dir) {
        const files = (0, fs_1.readdirSync)(dir);
        const result = [];
        for (const i in files)
            if ((0, fs_1.statSync)(path_1.default.join(dir, files[i])).isDirectory())
                result.push(files[i]);
        return result;
    }
    /**
     * Returns a list of files in the specified directory.
     *
     * @param dir path to directory
     */
    static fileList(dir) {
        const files = (0, fs_1.readdirSync)(dir);
        const result = [];
        for (const i in files)
            if (!(0, fs_1.statSync)(path_1.default.join(dir, files[i])).isDirectory())
                result.push(files[i]);
        return result;
    }
    /**
     * Checks if a path is a directory
     *
     * @param dir path to directory
    */
    static isDir(dir) {
        if ((0, fs_1.existsSync)(dir) && (0, fs_1.lstatSync)(dir).isDirectory())
            return true;
        return false;
    }
    /**
     * Checks if a path is a file
     *
     * @param f path to file
    */
    static isFile(f) {
        if ((0, fs_1.existsSync)(f) && (0, fs_1.lstatSync)(f).isFile())
            return true;
        return false;
    }
    /**
     * Try JSON parse
     *
     * Throws CoreError[IM_JSON_INCORRECT] if there is a parsing error.
     *
     * @param jsonRaw JSON raw string
     *
    */
    static tryJsonParse(jsonRaw) {
        try {
            return JSON.parse(jsonRaw);
        }
        catch (e) {
            throw ErrorManager_1.default.make('IM_JSON_INCORRECT', {
                jsonRaw, parsingError: (e instanceof Error) ? e.toString() : 'Unknown base json parse error'
            });
        }
    }
    /**
     * Return directory where VRack was launched from
    */
    static systemPath() {
        return process.cwd();
    }
    /**
     * Camelize string for input & action handlers
     *
     * Splits a string with a dot and returns the string
     * with capital letters starting from the second word
     *
     * @example
     * ```ts
     * ImportManager.camelize('input.device.port') // return inputDevicePort
     * ```
     *
     * @param text Like a `input.device.port` string
    */
    static camelize(text) {
        return text.replace(/^([A-Z])|[.]+(\w)/g, function (match, p1, p2, offset) {
            if (p2)
                return p2.toUpperCase();
            return p1.toLowerCase();
        });
    }
    /**
     * Try import method
    */
    static async tryImport(p) {
        try {
            return await Promise.resolve(`${p}`).then(s => __importStar(require(s)));
        }
        catch (error) {
            return false;
        }
    }
}
exports.default = ImportManager;
