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
     *    bool: Rule.boolean().required().default(true).description('Boolean checkbox')
     * }
     * ```
     *
     * After validating the object with the same properties
     *
     * ```
     * Validator.validate(rules, { bool: 'not a boolean value?'})
     * ```
     *
     *
     * **null / undefined semantics (fail-closed):**
     * - a missing key (undefined) is "absent": if a default() is set it is applied,
     *   otherwise a required() rule fails with VR_ERROR_REQUIRED and an
     *   optional rule passes (the type check of the field is skipped)
     * - a present value is always type-checked: an explicit null is rejected
     *   by the type checks (string, number, boolean, function, array, object;
     *   Rule.any() accepts it)
     * - NaN, Infinity and -Infinity are not valid numbers
     * - an unexpected exception inside a rule never lets the value pass:
     *   it is reported as a VR_VALIDATION_INTERNAL problem in VR_NOT_PASS
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
     * Wraps an unexpected (non-CoreError) exception into a VRack error
     *
     * The original exception message is preserved in the original argument
     * so the problem report stays informative and JSON-safe
     *
     * @param key key for getting value from object
     * @param err Unexpected exception
    */
    protected static makeInternalError(key: string, err: any): CoreError;
    /**
     * Safely exports a rule for the problem report
     *
     * A malformed rules table (a plain object or undefined instead of a
     * BasicType) must not break the error report itself
     *
     * @param rule Checked rule
    */
    protected static exportRule(rule: BasicType): IValidationRule;
    /**
     * Safely reads the validated value for the problem report
     *
     * The data object may be null or undefined (a malformed input) and
     * the report itself must not throw
     *
     * @param data Data object for validate
     * @param key key for getting value from object
    */
    protected static readValue(data: any, key: string): any;
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
     *  Rule.number().description('My number').message('{description} must be 1,2,3,4,5,6... not {value}')
     * ```
     *
     * Single-pass replacement: every {value} {example} {default}
     * {description} occurrence is substituted, the substituted text is
     * never re-scanned and values are inserted as-is (no $& / $$ artifacts)
    */
    protected static makeMessage(rule: IValidationRule, value: any): string;
    protected static toInspect(value: any): any;
}
