import BasicType from "../validator/types/BasicType";
import IAction from "./IAction";
import ILocalAction from "./ILocalAction";
/**
 * Action base class.
 * Forms settings for a new action in `fluent interface` style
*/
export default class BasicAction {
    protected action: ILocalAction;
    constructor();
    /**
     * Sets the requirements for incoming `Action` parameters
     * These rules will be applied every time the user invokes this action
     *
     * The method necessarily accepts an object.
     * An action method cannot accept anything other than an object
     *
     * @example
     *
     * ```ts
     * Action.global().requirements({
     *       id: Rule.number().require().default(0).description('Unique ID'),
     * })
     * ```
     * @param req Object of BasicType rules
    */
    requirements(req: {
        [key: string]: BasicType;
    }): this;
    /**
     * Sets the requirements for the return value.
     * This method does not guarantee that this action will return this particular data type.
     * In fact, the return value is not validated.
     * It may help to read the documentation for the device
     *
     * @example
     *
     * ```ts
     * Action.global().returns({
     *       id: Rule.number().require().default(0).description('Unique ID'),
     * })
     * ```
     *
     * @param ret Object of BasicType rules
    */
    returns(ret: {
        [key: string]: BasicType;
    }): this;
    /**
     * Set description of Action
     *
     * @example
     * ```ts
     * Action.global().description('Short action description')
     * ```
    */
    description(des: string): this;
    /**
     * Returns the internal Action object.
     * This method is used inside VRack2 when processing an Action inside Container
     *
     * **Do not use this method if it is not necessary**
    */
    exportRaw(): ILocalAction;
    /**
     * Forms a new IAction object
     * This method is used inside VRack2 when processing an Action inside Container
     *
     * **Do not use this method if it is not necessary**
     *
     * !hide for external users
     * @private
    */
    export(): IAction;
}
