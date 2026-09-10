import IValidationRule from "./IValidationRule";
export default interface IValidationProblem {
    /** VRack Error manager short code like a VS_ERROR_DATABASE_NF */
    type: string;
    /** VRack Error manager error code like a random string */
    code: string;
    /** Error string (description) with the message template applied */
    description: string;
    /** Exported validation rule */
    rule: IValidationRule;
    /**
     * Additional arguments for error
     * Standard shape: { key } is always present, plus the problem-specific
     * data like a { limit } for VR_NUMBER_MAX/MIN, { index } for
     * VR_ARRAY_CONTENT_ERROR, { original } for VR_VALIDATION_INTERNAL
     */
    arg: any;
    /** key for getting value from object */
    fieldKey: string;
}
