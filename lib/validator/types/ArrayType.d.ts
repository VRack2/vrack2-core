import BasicType from "./BasicType";
import IValidationSubrule from "../IValidationSubrule";
export default class ArrayType extends BasicType {
    constructor();
    /**
     * Setting the default value
    */
    default(def: Array<any>): this;
    /**
     * Sets the rule to be applied to each element of the array
     *
     * @example
     *
     * ```
     * Rule.array().require().content(
     *    Rule.string().default('').maxLength(24).description('Element of list')
     * )
     * ```
     *
    */
    content(t: BasicType): this;
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex: Array<any>): this;
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
     * Checks the rules for content inside the array
     *
     * @param obj Validation object
     * @param key Key for getting value from object
     * @param sub Sub rule for check array content
    */
    protected checkContent(obj: {
        [key: string]: any;
    }, key: string, sub: IValidationSubrule): void;
}
