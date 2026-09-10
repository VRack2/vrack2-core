import IValidationRule from "../IValidationRule";
import IValidationSubrule, { SubruleName } from "../IValidationSubrule";
/** A subrule checker: validates one subrule (constraint) of the rule */
export type SubruleChecker = (obj: {
    [key: string]: any;
}, key: string, sub: IValidationSubrule) => void;
export default class BasicType {
    protected rule: IValidationRule;
    /** Checkers table: subrule name -> checker (subrule dispatch) */
    protected checkers: Map<SubruleName, SubruleChecker>;
    /** Cached deep export of the rule (invalidated on every mutation of the rule) */
    protected exported?: IValidationRule;
    constructor();
    /**
     * Marks the field as required.
     *
     * A missing value (undefined) fails with VR_ERROR_REQUIRED.
     * Without this flag the field is optional: a missing value passes and
     * skips the type check of the rule. A present value is always
     * type-checked (an explicit null is present and is rejected)
     */
    required(): this;
    /**
     * Вскоре будет удален
     * @see required
     * @deprecated use required()
    */
    require(): this;
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex: any): this;
    /**
     * Description of the validated object property
     *
     * @param desc
    */
    description(desc: string): this;
    /**
      * Make message use message template
      *
      * If you want to change the default message, you can use a template in the message parameter
      *
      * @example
      * ```js
      *  Rule.number().description('My number').message('{description} must be 1,2,3,4,5,6... not {value}')
      * ```
      * Use {description} {value} {default} {example} in template
     */
    message(mess: string): this;
    /**
     * Exporting a rule for use
     * Typically used within VRack or VRack-Core
     *
     * Returns a snapshot of the rule state: the deep state (defaults,
     * subrules) is deep-cloned once per mutation and shared from the
     * per-instance cache, while each call gets its own top-level object,
     * so mutating the result never touches the live rule. A function
     * default is preserved as-is (by reference) where a JSON roundtrip
     * would drop it. The result must be treated as read-only
     *
     * !!! hide for external users !!!
     * @private
    */
    export(): any;
    /**
     * This method will be executed when converting a Rule object to JSON
     *
     * Returns a safe copy (see export()): mutating the result never
     * touches the live rule
    */
    toJSON(): any;
    /**
     * Invalidates the cached export
     *
     * Must be called by every method that mutates the rule, so that the
     * next export() reflects the new state of the rule
     */
    protected invalidateExport(): void;
    /**
     * Adds a subrule (a constraint) to the rule
     *
     * The name is a SubruleName (see SubruleNames): a typo in the name
     * is a compile error
     *
     * @param name Name of the subrule (one of SubruleNames)
     * @param args Arguments of the subrule
     */
    protected addSubrule(name: SubruleName, args: any): void;
    /**
     * Dispatches all subrules of the rule to their checkers (the checkers table)
     *
     * A subrule name that has no registered checker never passes silently:
     * it fails with VR_TYPE_NOT_EXISTS (fail-closed)
     *
     * @param obj Validation object
     * @param key Key for getting value from object
     */
    protected checkSubrules(obj: {
        [key: string]: any;
    }, key: string): void;
    /**
     * Performs general validation rules
     *
     * Returns false when the value is absent (undefined) and the rule is
     * not required: the caller must skip the type check for the field
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected basicValidate(obj: {
        [key: string]: any;
    }, key: string): boolean;
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
     * Sets the default value if it has not been set
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected checkDefault(obj: {
        [key: string]: any;
    }, key: string): void;
    /**
     * Returns a safe copy of a value
     *
     * Primitives and functions are returned as-is. Objects and arrays are
     * deep-cloned (structuredClone when available, a recursive plain clone
     * otherwise) so that a change in one validated object can never mutate
     * the rule default or another validated object
     *
     * @param value Value to clone
    */
    protected static clone(value: any): any;
    /**
     * Checks the required flag of the rule
     *
     * Only undefined means "absent" here; an explicit null is present and
     * is left to the type check of the rule.
     * An absent value fails only when the rule is required(); otherwise
     * the field is optional and passes
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected checkRequire(obj: {
        [key: string]: any;
    }, key: string): void;
}
