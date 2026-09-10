/**
 * Wire names of the built-in subrules.
 *
 * Use these constants (not raw string literals) everywhere a subrule
 * name is produced, so that a typo in the name is a compile error.
 * The union type SubruleName is derived from this object.
 *
 * Note: 'contain' is the wire name of the array content subrule added
 * by ArrayType.content(); it is kept as-is for backward compatibility
 * of exported rules
 */
export const SubruleNames = {
    minLength: 'minLength',
    maxLength: 'maxLength',
    min: 'min',
    max: 'max',
    integer: 'integer',
    contain: 'contain',
    fields: 'fields',
} as const

/** Union of the built-in subrule names */
export type SubruleName = (typeof SubruleNames)[keyof typeof SubruleNames]

export default interface IValidationSubrule<Name extends string = string> {
    /** Name of subrule like a 'minLength', 'maxLength', 'min', 'max', 'integer', 'contain', 'fields' (see SubruleNames) */
    name: Name;

    /** Subrule arguments */
    args: any;
}
