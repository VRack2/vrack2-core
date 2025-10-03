export default class ImportManager {
    /**
     * Dynamic import method
     *
     * @param {string} path Full or relative path to file
    */
    static importPath(raPath: string): Promise<any>;
    /**
     * Import class like a vrack2 device style
     *
     * Разделяюет переданную строку пути на 2 части.
     * Первая честь является названием модуля, а вторая часть классом внутри него
     *
     * @example ImportManager.importClass('vrack2-core.Container')
    */
    static importClass(cs: string): Promise<any>;
    /**
     * Attempts to open a file and use its contents as json
     *
     * Returns the result of parsing json
     *
     * @returns {any} json parsing result
    */
    static importJSON(filePath: string): any;
    /**
     * Returns the class name in the style of import vrack
     *
     * return `Container` from 'vrack2-core.Container' string
     *
     * @param cs Import class string
     *
    */
    static importClassName(cs: string): string | undefined;
    /**
     * Returns the vendor name in the style of import vrack
     *
     * return `vrack2-core` from 'vrack2-core.Container' string
     *
     * @param cs Import class string
    */
    static importVendorName(cs: string): string | undefined;
    /**
     * Returns a list of directories in the specified directory.
     *
     * @param dir path to directory
     */
    static dirList(dir: string): string[];
    /**
     * Returns a list of files in the specified directory.
     *
     * @param dir path to directory
     */
    static fileList(dir: string): string[];
    /**
     * Checks if a path is a directory
     *
     * @param dir path to directory
    */
    static isDir(dir: string): boolean;
    /**
     * Checks if a path is a directory
     *
     * @param f path to file
    */
    static isFile(f: string): boolean;
    /**
     * Try JSON parse
     *
     * Returns an CoreError[IM_JSON_INCORRECT] if there is a parsing error.
     *
     * @param jsonRaw JSON raw string
     *
    */
    static tryJsonParse(jsonRaw: string): any;
    /**
     * Return directory where VRack was launched from
    */
    static systemPath(): string;
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
    static camelize(text: string): string;
    /**
     * Try import method
    */
    protected static tryImport(p: string): Promise<any>;
}
