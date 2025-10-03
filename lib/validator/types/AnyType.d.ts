import BasicType from "./BasicType";
export default class AnyType extends BasicType {
    constructor();
    /**
     * Setting the default value
    */
    default(def: any): this;
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
