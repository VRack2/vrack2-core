import BasicType from "./BasicType";
export default class BooleanType extends BasicType {
    constructor();
    /**
     * Setting the default value
    */
    default(def: boolean): this;
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex: boolean): this;
    /**
     * Method of validation of this type
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: {
        [key: string]: any;
    }, key: string): boolean;
}
