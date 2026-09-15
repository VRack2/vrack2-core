/**
 * Base class for error realization with the ability to
 * import and export error classes for client-server operations.
 *
 * In VRack, a lot of things are transmitted over the network as JSON.
 * Since pure errors are not converted to JSON, methods were made to export and
 * import them while preserving the main important properties.
 *
 * If the imported error has properties that are not in the base class,
 * they will be added. To get unknown properties you can use the function
 * (for typescript) getUnknownProperty.
 *
*/
declare class CoreError extends Error {
    /** Flag that the error belongs to VRack */
    vError: boolean;
    /**
     * The single canonical identifier of the error (a short human-readable
     * word, e.g. `VLDR_WRONG_TYPE`). This is what `ErrorManager.isCode` and
     * the docs reference; there is no separate random "code" field.
     */
    vShort: string;
    /**
     * Keys of dynamic parameters that were merged in at error creation time
     * (declared in the registered definition's `rules`) or added via
     * `import()` from a network payload. Used on the importing side to
     * distinguish dynamic fields from the base class shape.
     */
    vAdd: Array<string>;
    /** Nested errors */
    vAddErrors: Array<Error>;
    constructor(name: string, message: string, short: string);
    /**
     * Sets the stacktrace of the error above
     * It is necessary for the stacktrace to refer to the
     * required file and not to ErrorManager
     *
     * @param err Error
     * @example Example of assigning a more correct path to the file where the error occurred
     * ```
     *     ErrorManager.make('EM_CODE_NOT_FOUND').setTrace(new Error())
     * ```
    */
    setTrace(err: Error): this;
    /**
     * Imports an error that came over the network as a JSON object
     * Uses objectify for the incoming object just in case
     *
     * @returns {CoreError} this после модификации
    */
    import(error: any): this;
    /**
     * Returns an object to be transmitted over the network
     * with preliminary conversion to JSON
     *
     * @see objectify
    */
    export(): any;
    /**
     * Add nested error
     *
     * @param err Nested error
    */
    add(err: Error): this;
    /**
     * For Typescript it is used to retrieve an unknown
     * instance property after importing an incoming error
    */
    getUnknownProperty(field: string): any | undefined;
    /**
     *  Returns an object to be transmitted over the network
     *
     * @param {any} error Error for conversion to an object
     * */
    static objectify(error: any): any;
}
export default CoreError;
