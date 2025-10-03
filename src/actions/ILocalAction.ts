import BasicType from "../validator/types/BasicType";

/**
 * Internal (raw exported) Action interface
*/
export default interface ILocalAction {
    /** Type of action ('global' as default) */
    type: string;
    /** Requirements for incoming data */
    requirements: { [key: string]: BasicType; };
    /** Requirements to returned data  */
    returns: { [key: string]: BasicType; };
    /** A short text description of the action */
    description: string;
}
