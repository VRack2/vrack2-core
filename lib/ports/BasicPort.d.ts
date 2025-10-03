import BasicType from "../validator/types/BasicType";
import ILocalPort from "./ILocalPort";
import IPort from "./IPort";
/**
 * Port basic class.  Used internally to define device ports.
*/
export default class BasicPort {
    protected port: ILocalPort;
    constructor();
    /**
     * Sets this port to dynamic
     *
     * If you specify a port to be dynamic, you must specify the number of those ports.
     * Also if you specify a port as dynamic, you must specify `%d` in the name,
     * which will be replaced by the port number.
     *
     * @example
     * ```ts
     * {
     *   'command%d': Port.return().dynamic(this.options.inputs)
     * }
     * ```
     *
     * @param count Count of ports
    */
    dynamic(count: number): this;
    /**
     * Specifies a recommendation to the data passing through the port.
     * This data is not actually validated by these rules,
     * but these rules can be used in the documentation to clarify perception.
     *
     * @param req BasicType type
    */
    requirement(req: BasicType): this;
    /**
     * Port descriptions
    */
    description(des: string): this;
    /**
     * Exports the port data.
     * Collects all data into an IPort object.
     * Internal types of type BasicType are also exported to the corresponding properties
     *
     * @see IPort
     *
     * !hide for external users
     * @private
    */
    export(): IPort;
}
