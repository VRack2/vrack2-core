import IValidationRule from "../IValidationRule";
export default class BasicType {
    protected rule: IValidationRule;
    constructor();
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
      *  Rule.number().description('My number').message('{description} must by 1,2,3,4,5,6... not {value}')
      * ```
      * Use {description} {value} {default} {example} in template
     */
    message(mess: string): this;
    /**
     * Exporting a rule for use
     * Typically used within VRack or VRack-Core
     *
     * !!! hide for external users !!!
     * @private
    */
    export(): any;
    /**
     * This method will be executed when converting a Rule object to JSON
    */
    toJSON(): IValidationRule;
    /**
     * Performs general validation rules
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
     * Checks if the initialized property of an object
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected checkRequire(obj: {
        [key: string]: any;
    }, key: string): void;
}
