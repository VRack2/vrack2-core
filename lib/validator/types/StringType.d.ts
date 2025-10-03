import BasicType from "./BasicType";
import IValidationSubrule from "../IValidationSubrule";
export default class StringType extends BasicType {
    constructor();
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex: string): this;
    /**
     * Setting the default value
    */
    default(def: string): this;
    /**
     * Sets the maximum length of the string
    */
    maxLength(max: number): this;
    /**
     * Sets the minimum length of the string
    */
    minLength(min: number): this;
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
     * Checking the maximum string length
    */
    protected checkMaxLength(obj: {
        [key: string]: any;
    }, key: string, sub: IValidationSubrule): void;
    /**
     * Checking the minimum string length
    */
    protected checkMinLength(obj: {
        [key: string]: any;
    }, key: string, sub: IValidationSubrule): void;
}
