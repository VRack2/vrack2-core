import  IValidationSubrule  from "./IValidationSubrule";

export default interface IValidationRule {
    /** Rule type like a 'string', 'number', 'boolean', 'object', 'array', 'function' or 'any' */
    type: string;
    /** Whether the field is required: a missing (undefined) value fails with VR_ERROR_REQUIRED */
    require: boolean;
    /** Default value applied to the data when the field is missing (undefined) */
    default: any;
    /** Subrules (constraints) of the rule like a minLength, max, contain, fields (names: SubruleNames) */
    rules: Array<IValidationSubrule>;
    /** Example of a valid value */
    example: any;
    /** Description of the validated field */
    description: string;
    /**
     * Template for error message string
     * Use like a "{description} field must be like a '123' number "
     * You can use {description} {value} {default} {example} in template 
     */
    message: string;
}
