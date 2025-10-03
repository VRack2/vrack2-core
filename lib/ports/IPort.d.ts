import IValidationRule from "../validator/IValidationRule";
export default interface IPort {
    /** Port Type - Returned or Standard */
    type: string;
    /** Specifies a recommendation to the data passing through the port.  */
    requirement?: IValidationRule;
    /** Specifies a recommendation for the data returned by the port */
    return?: IValidationRule;
    /** Port description */
    description: string;
    /** Is the connection of this port mandatory */
    required: boolean;
    /** Whether the port is dynamic */
    dynamic: boolean;
    /** Count of dynamic ports */
    count: number;
}
