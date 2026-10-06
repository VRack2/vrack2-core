import { existsSync, readFileSync, lstatSync, readdirSync, statSync } from "fs";
import path from "path";

import ErrorManager from "./errors/ErrorManager";
import Rule from "./validator/Rule";


ErrorManager.registerMany('ImportManager', [
    {
        short: 'IM_FILE_NOT_FOUND',
        description: 'Import file not found',
        rules: { filePath: Rule.string().description('Path to file') }
    },
    {
        short: 'IM_IMPORT_FAILED',
        description: 'Cannot import the referenced class (file path or package path)',
        rules: { ref: Rule.string().description('Reference string (file path or package path)') }
    },
    {
        short: 'IM_JSON_INCORRECT',
        description: 'Import file json incorrect',
        rules: {
            jsonRaw: Rule.string().description('Raw json data'),
            parsingError: Rule.string().description('Json parse error string')
        }
    },
    {
        short: 'IM_CLASS_PATH_ERROR',
        description: 'Error import class - No acts',
        rules: { path: Rule.string().description('Class path string') }
    },
    {
        short: 'IM_CLASS_VENDOR_ERROR',
        description: 'Error import class - vendor not found',
        rules: { path: Rule.string().description('Class path string') }
    },
    {
        short: 'IM_CLASS_ACT_ERROR',
        description: 'Error import class - class act = undefined',
        rules: { path: Rule.string().description('Class path string') }
    },
])


export default class ImportManager {
    /**
     * Dynamic import method
     * 
     * @param {string} path Full or relative path to file
    */
    static async importPath(raPath: string) {

        // IF we have absolute path
        if (path.isAbsolute(raPath)){
            const ti = await ImportManager.tryImport(raPath)
            if (ti !== false) return ti
        }
        const mbfp = path.join(ImportManager.systemPath(), raPath)
        if (existsSync(mbfp)){
            const ti = await ImportManager.tryImport(raPath)
            if (ti !== false) return ti
        }
        const ti = await import(raPath)
        return ti
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
    static async importClass(cs:string) {
        const acts = cs.split('.')
        const vendor = acts.shift()
        if (typeof vendor !== 'string') throw ErrorManager.make('IM_CLASS_PATH_ERROR', { path: cs })
        let ret = await ImportManager.tryImport(vendor)
        if (ret === false) throw ErrorManager.make('IM_CLASS_VENDOR_ERROR', { path: cs })
        for (const act of acts) {
            ret = ret[act]
            if (ret === undefined) throw ErrorManager.make('IM_CLASS_ACT_ERROR', { path: cs })
        }
        return ret
    }

    /**
     * Universal class resolution.
     *
     * Automatically detects what `ref` is and returns the exported class:
     *
     * 1. a **local file** (absolute path, or a path relative to the system dir,
     *    or any path containing a `/` / known file extension) → the file is
     *    imported and its `default` export is returned;
     * 2. a **package path** `vendor.Class` (dotted, no path separator) →
     *    resolved with `importClass()` (named-export walk);
     * 3. a **bare package** → imported and its `default` export is returned.
     *
     * This lets the same string field name a boot class (or device) either by
     * a local file (`./boot/MyRegistry.js`) or by package
     * (`vrack2-core.DeviceManager`) — the correct one is picked automatically.
     *
     * @example ImportManager.importClassUniversal('./boot/MyRegistry.js')
     * @example ImportManager.importClassUniversal('vrack2-core.DeviceManager')
     *
     * @param ref Local file path (absolute / relative) or VRack2-style package path.
     */
    static async importClassUniversal(ref: string) {
        // 1) Local file (absolute, or relative to the system dir).
        if (ImportManager.looksLikeFilePath(ref)) {
            return ImportManager.importFileClass(ref)
        }
        // 2) Package path `vendor.Class` (named-export walk).
        if (ref.includes('.')) {
            return ImportManager.importClass(ref)
        }
        // 3) Bare package (default export).
        const mod = await ImportManager.tryImport(ref)
        if (mod) return mod.default ?? mod
        throw ErrorManager.make('IM_IMPORT_FAILED', { ref })
    }

    /**
     * Import a local file (absolute, or relative to the system dir) and return
     * its class — the `default` export (CJS `module.exports` lands there too).
     *
     * @throws CoreError[IM_FILE_NOT_FOUND] if the file cannot be imported.
     */
    protected static async importFileClass(ref: string) {
        const abs = path.isAbsolute(ref) ? ref : path.resolve(ImportManager.systemPath(), ref)
        const mod = await ImportManager.tryImport(abs)
        if (!mod) throw ErrorManager.make('IM_FILE_NOT_FOUND', { filePath: abs })
        return mod.default ?? mod
    }

    /**
     * Heuristic: is `ref` a local file path (as opposed to a `vendor.Class`
     * package path)?
     *
     * True for absolute paths, `./` / `../` relatives, anything containing a
     * path separator (except `@scope/...` packages), or a known module
     * extension (`.js` / `.mjs` / `.cjs` / `.ts` / `.json` / `.node`).
     */
    protected static looksLikeFilePath(ref: string) {
        if (ref.startsWith('@')) return false
        if (path.isAbsolute(ref) || ref.startsWith('./') || ref.startsWith('../')) return true
        if (ref.includes('/')) return true
        return /\.(m?c?js|json|node|ts)$/i.test(ref)
    }

    /**
     * Attempts to open a file and use its contents as json
     * 
     * Returns the result of parsing json
     * 
     * @returns {any} json parsing result
    */
    static importJSON(filePath: string){
        if (!path.isAbsolute(filePath)){
            filePath =  path.join(ImportManager.systemPath(), filePath)
        }
        if (existsSync(filePath)){
            const jdata = readFileSync(filePath).toString('utf-8')
            return ImportManager.tryJsonParse(jdata)
        }
        throw ErrorManager.make('IM_FILE_NOT_FOUND', { filePath })
    }

    /**
     * Returns the class name in the style of import vrack
     * 
     * return `Container` from 'vrack2-core.Container' string
     * 
     * @param cs Import class string
     * 
    */
    static importClassName(cs: string){
        const acts = cs.split('.')
        return acts.pop()
    }

    /**
     * Returns the vendor name in the style of import vrack
     * 
     * return `vrack2-core` from 'vrack2-core.Container' string
     * 
     * @param cs Import class string
    */
    static importVendorName(cs: string){
        const acts = cs.split('.')
        return acts.shift()
    }

    /**
     * Returns a list of directories in the specified directory.
     * 
     * @param dir path to directory
     */
    static dirList(dir: string){
        const files = readdirSync(dir)
        const result = []
        for (const i in files) if (statSync(path.join(dir, files[i])).isDirectory()) result.push(files[i])
        return result
    }

    /**
     * Returns a list of files in the specified directory.
     * 
     * @param dir path to directory
     */
    static fileList(dir: string){
        const files = readdirSync(dir)
        const result = []
        for (const i in files) if (!statSync(path.join(dir, files[i])).isDirectory()) result.push(files[i])
        return result
    }

    /**
     * Checks if a path is a directory
     * 
     * @param dir path to directory
    */
    static isDir(dir: string){
        if (existsSync(dir) && lstatSync(dir).isDirectory()) return true
        return false
    }

    /**
     * Checks if a path is a file
     * 
     * @param f path to file
    */
    static isFile(f: string){
        if (existsSync(f) && lstatSync(f).isFile()) return true
        return false
    }

    /**
     * Try JSON parse
     * 
     * Throws CoreError[IM_JSON_INCORRECT] if there is a parsing error.
     * 
     * @param jsonRaw JSON raw string
     * 
    */
    static tryJsonParse(jsonRaw: string) : any{
        try {
            return JSON.parse(jsonRaw)
        } catch (e) {
            throw ErrorManager.make('IM_JSON_INCORRECT', {
                jsonRaw, parsingError: (e instanceof Error)?e.toString() : 'Unknown base json parse error'
            })
        }
    }
    
    /**
     * Return directory where VRack was launched from
    */
    static systemPath(){
        return process.cwd()
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
    static camelize(text: string) {
        return text.replace(/^([A-Z])|[.]+(\w)/g, function (match, p1, p2, offset) {
            if (p2) return p2.toUpperCase()
            return p1.toLowerCase()
        })
    }

    /**
     * Try import method
    */
    protected static async tryImport(p: string){
        try {
            return await import(p)
        } catch (error){
            return false
        }
    }
}