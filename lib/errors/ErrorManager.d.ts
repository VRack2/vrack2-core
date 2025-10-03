import BasicType from "../validator/types/BasicType";
import CoreError from "./CoreError";
/**
 * A simple class for creating errors.
 * This centralized class is useful because you can find out t
 * he list of all registered errors and which group/component they belong to.
 */
declare class ErrorManager {
    /**
     * List of registered errors
    */
    private registeredList;
    /**
     * Error registration. An error must be registered before creating it
     *
     * @param name Property for error grouping
     * @param code Unique random string code ID
     * @param short Readable unique identifier
     * @param description Error string (description)
    */
    register(name: string, code: string, short: string, description: string, rules?: {
        [key: string]: BasicType;
    }): void;
    /**
     * Creating an instance of an error
     *
     * @param short
     * @param additional
    */
    make(short: string, additional?: {}): CoreError;
    /**
     * Converts a normal error to a VRack error
     *
     * @param error Ошибка для преобразования
    */
    convert(error: any): any;
    /**
     * Searches for an error by code or short
     *
     * @param short Short error code or search error code
    */
    private getRegistered;
}
declare const GlobalErrorManager: ErrorManager;
export default GlobalErrorManager;
