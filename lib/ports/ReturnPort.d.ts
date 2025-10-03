import BasicType from "../validator/types/BasicType";
import BasicPort from "./BasicPort";
export default class ReturnPort extends BasicPort {
    constructor();
    /**
     * Specifies a recommendation to the data return from the port.
     *
     * @param req BasicType type
    */
    return(req: BasicType): this;
}
