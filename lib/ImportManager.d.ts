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
     * Разделяет переданную строку пути на части.
     * Первая часть является названием модуля, а следующие части —
     * путём к вложенному классу внутри него
     *
     * @example ImportManager.importClass('vrack2-core.Container')
    */
    static importClass(cs: string): Promise<any>;
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
    static importClassUniversal(ref: string): Promise<any>;
    /**
     * Import a local file (absolute, or relative to the system dir) and return
     * its class — the `default` export (CJS `module.exports` lands there too).
     *
     * @throws CoreError[IM_FILE_NOT_FOUND] if the file cannot be imported.
     */
    protected static importFileClass(ref: string): Promise<any>;
    /**
     * Heuristic: is `ref` a local file path (as opposed to a `vendor.Class`
     * package path)?
     *
     * True for absolute paths, `./` / `../` relatives, anything containing a
     * path separator (except `@scope/...` packages), or a known module
     * extension (`.js` / `.mjs` / `.cjs` / `.ts` / `.json` / `.node`).
     */
    protected static looksLikeFilePath(ref: string): boolean;
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
     * Checks if a path is a file
     *
     * @param f path to file
    */
    static isFile(f: string): boolean;
    /**
     * Try JSON parse
     *
     * Throws CoreError[IM_JSON_INCORRECT] if there is a parsing error.
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
