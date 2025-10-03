import BasicType from "../validator/types/BasicType";
export default interface ILocalPort {
    /** Port Type - Returned or Standard */
    type: string;
    /** Specifies a recommendation to the data passing through the port.  */
    requirement?: BasicType;
    /** Specifies a recommendation for the data returned by the port */
    return?: BasicType;
    /** Port description */
    description: string;
    /** Is the connection of this port mandatory */
    required: boolean;
    /** Whether the port is dynamic */
    dynamic: boolean;
    /** Count of dynamic ports */
    count: number;
}
