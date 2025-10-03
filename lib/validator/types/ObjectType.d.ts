import BasicType from "./BasicType";
import IValidationSubrule from "../IValidationSubrule";
export default class ObjectType extends BasicType {
    constructor();
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex: any): this;
    /**
     * Setting the default value
    */
    default(def: object): this;
    /**
     * Rule object for defining properties
     *
     * Allows you to describe the fields of the required object
     *
     * @example
     * ```ts
     *  obj: Rule.object().fields({
     *       bool: Rule.boolean().require().default(true).description('Boolean checkbox')
     *  }).description('TEst ibject description'),
     * ```
    */
    fields(obj: {
        [key: string]: BasicType;
    }): this;
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
     * Validate object fields
    */
    protected subValidate(obj: {
        [key: string]: any;
    }, key: string, sub: IValidationSubrule): void;
}
