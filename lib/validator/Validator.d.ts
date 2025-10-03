import BasicType from "./types/BasicType";
import CoreError from "../errors/CoreError";
import IValidationProblem from './IValidationProblem';
import IValidationRule from "./IValidationRule";
export default class Validator {
    /**
     * Validation of the object by rule.
     * You cannot validate a specific value.
     * You can only validate an object property.
     *
     * For validation you need to create an object with rules
     *
     * ```ts
     * const rules = {
     *    bool: Rule.boolean().require().default(true).description('Boolean checkbox')
     * }
     * ```
     *
     * After validating the object with the same properties
     *
     * ```
     * Validator.validate(rules, { bool: 'not a boolean value?'})
     * ```
     *
     * @param rules List of rules like a associate object
     * @param data Data object for validate
    */
    static validate(rules: {
        [key: string]: BasicType;
    }, data: {
        [key: string]: any;
    }): boolean;
    /**
     * Creates a top-level error for validation problems
     *
     * @param eList List of validation errors
    */
    protected static makeError(eList: Array<IValidationProblem>): void;
    /**
     * Create validation problem
     *
     * @param err Validation exception
     * @param key key for getting value from object
     * @param rule Checked rule
    */
    protected static makeProblem(err: CoreError, key: string, rule: IValidationRule, value: any): IValidationProblem;
    /**
     * Make message use message template
     *
     * If you want to change the default message, you can use a template in the message parameter
     *
     * @example
     * ```js
     *  Rule.number().description('My number').message('{description} must by 1,2,3,4,5,6... not {value}')
     * ```
    */
    protected static makeMessage(rule: IValidationRule, value: any): string;
    protected static toInspect(value: any): any;
}
