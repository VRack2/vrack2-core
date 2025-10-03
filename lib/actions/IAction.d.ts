import IValidationRule from "../validator/IValidationRule";
/**
 * Internal (exported) Action interface
*/
export default interface IAction {
    /** Type of action ('global' as default) */
    type: string;
    /** Requirements for incoming data */
    requirements: {
        [key: string]: IValidationRule;
    };
    /** Requirements to returned data  */
    returns: {
        [key: string]: IValidationRule;
    };
    /** A short text description of the action */
    description: string;
}
