import { existsSync, readFileSync, lstatSync, readdirSync, statSync } from "fs";
import path from "path";

import ErrorManager from "./errors/ErrorManager";
import Rule from "./validator/Rule";


ErrorManager.register('ImportManager', 'kwRobwFPzc5g', 'IM_FILE_NOT_FOUND',
    'Import file not found', {
    filePath: Rule.string().description('Path to file')
})

ErrorManager.register('ImportManager', 'dMJfR6rmC7o6', 'IM_JSON_INCORRECT',
    'Import file json incorrect', {
    jsonRaw: Rule.string().description('Raw json data'),
    parsingError: Rule.string().description('Json parse error string')
})

ErrorManager.register('ImportManager', 'u3dsX3vZpKrz', 'IM_CLASS_PATH_ERROR',
    'Error import class - No acts', {
    path: Rule.string().description('Class path string')
})

ErrorManager.register('ImportManager', 'PscFAcmXr11U', 'IM_CLASS_VENDOR_ERROR',
    'Error import class - vendor not found', {
    path: Rule.string().description('Class path string')
})

ErrorManager.register('ImportManager', 'm9MJNeKv3xYW', 'IM_CLASS_ACT_ERROR',
    'Error import class - class act = undefined', {
    path: Rule.string().description('Class path string')
})


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
     * Разделяюет переданную строку пути на 2 части. 
     * Первая честь является названием модуля, а вторая часть классом внутри него 
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
     * Checks if a path is a directory
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
     * Returns an CoreError[IM_JSON_INCORRECT] if there is a parsing error.
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