import IValidationRule from "./IValidationRule";

export default interface IValidationProblem {
    /** VRack Error manager short code like a VS_ERROR_DATABASE_NF */
    type: string;
    /** VRack Error manager error code like a random string */
    code: string;
    /** Error string (description) */
    description: string;
    /** Exported validation rule */
    rule: IValidationRule
    /** Additional arguments for error */
    arg: any;
    /** key for getting value from object */
    fieldKey: string;
}
