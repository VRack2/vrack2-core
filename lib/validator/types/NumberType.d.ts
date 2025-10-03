import BasicType from "./BasicType";
import IValidationSubrule from "../IValidationSubrule";
export default class NumberType extends BasicType {
    constructor();
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex: number): this;
    /**
     * Setting the default value
    */
    default(def: number): this;
    /**
     * Adds an integer check
    */
    integer(): this;
    /**
     * Defines the maximum value for the rule
    */
    max(max: number): this;
    /**
     * Defines the minimal value for the rule
    */
    min(min: number): this;
    /**
     * Method of validation of this type
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: {
        [key: string]: any;
    }, key: string): boolean;
    /**
     *  Checking the maximum value
    */
    protected checkMax(obj: {
        [key: string]: any;
    }, key: string, sub: IValidationSubrule): void;
    /**
     *  Checking the minimal value
    */
    protected checkMin(obj: {
        [key: string]: any;
    }, key: string, sub: IValidationSubrule): void;
    /**
     * Integer check
    */
    protected checkInteger(obj: {
        [key: string]: any;
    }, key: string): void;
}
