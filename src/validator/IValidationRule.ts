import  IValidationSubrule  from "./IValidationSubrule";

export default interface IValidationRule {
    /** VRack Error manager short code like a VS_ERROR_DATABASE_NF */
    type: string;
    /** VRack Error manager error code like a random string */
    require: boolean;
    /** Error string (description) */
    default: any;
    /** Exported validation rule */
    rules: Array<IValidationSubrule>;
    /** Additional arguments for error */
    example: any;
    /** key for getting value from object */
    description: string;
    /**
     * Template for error message string
     * Use like a "{description} field must by like a '123' number "
     * You can use {description} {value} {default} in template 
     */
    message: string;
}
