import BasicType from "../validator/types/BasicType";
import Container from '../Container';
import BasicAction from "../actions/BasicAction";
import BasicPort from "../ports/BasicPort";
import DevicePort from "./DevicePort";
import BasicMetric from "../metrics/BasicMetric";
export declare enum EDeviceMessageTypes {
    terminal = "terminal",
    info = "info",
    error = "error",
    event = "event",
    action = "action",
    alert = "alert"
}
interface IDeviceSettings {
    /**
     * List of broadcast channels
     * Device channels list:
     *  - terminal
     *  - notify
     *  - event
     *  - action
     *  - alert
     *  - error
     *  - render
    */
    channels: Array<'terminal' | 'notify' | 'event' | 'action' | 'alert' | 'error' | 'render'>;
}
export default class Device {
    /**
     * Device unique for this container id
     * the name usually begins with a capital letter
     *
     * @example 'DeviceName'
     * */
    id: string;
    /**
     * Device type string
     * Uses the vendor name and device name
     * @example 'vrack.KeyManager'
    */
    type: string;
    /**
     * Allows access to port management.
    */
    ports: {
        input: {
            [key: string]: DevicePort;
        };
        output: {
            [key: string]: DevicePort;
        };
    };
    /**
     * Active loader container
     * */
    Container: Container;
    /**
     * Device options
     *
     * @see checkOptions()
    */
    options: {
        [key: string]: any;
    };
    /**
     * @param id Unique ID
     * @param type Device type string
     * @param Container Active loader container
    */
    constructor(id: string, type: string, Container: Container);
    /**
     * Device settings
     *
     * Needs to be finalized"
    */
    settings(): IDeviceSettings;
    /**
     * Short device description. Can use markdown markup
     *
     * @return {string} Device description
     * */
    description(): string;
    /**
     * This is a fast updating data object - it will be sent
     * to subscribers after the render() call
     *
     * @see render()
     * */
    shares: any;
    /**
     * This data will be loaded for the specific instance of the device.
     * The device itself determines this data and saves it at the right moment
     *
     * The structure is determined by the device
    */
    storage: any;
    /**
     * Device action list
     * Device actions can be called from the container.
     * This is a way to interact with the device from the outside world
     *
     * @example
     * ```
     *  return {
     *      'test.action': Action.global().requirements({
     *          id: Rule.string().require().default('www').description('Some id')
     *      }).description('Test action')
     *  }
     * ```
     *
     * A handler must be created for each action. For example, for `test.action` action `actionTestAction` must be created.
     * */
    actions(): {
        [key: string]: BasicAction;
    };
    /**
     * Defining device metrics.
     *
     * @example
     *
     * ```
     * return {
     *  'test.metric': Metric.inS().retentions('1s:6h').description('Test metric')
     * }
     * ```
     * @see BasicMetric
    */
    metrics(): {
        [key: string]: BasicMetric;
    };
    /**
     * Run before each device action
     *
     * @param action "device.action" like string
     * @param data  data for action
    */
    beforeAction(action: string, data: any): boolean;
    /**
     * Prepare options
     *
     * this method call before validating options
    */
    prepareOptions(): void;
    /**
     * Defining a list of device parameters
     *
     * @example
     * ```ts
     * return {
     *      timeout: Rule.number().integer().min(0).description('Interval timeout').example(0)
     * }
     * ```
     *
     * @returns {Array<Rule>}
     * */
    checkOptions(): {
        [key: string]: BasicType;
    };
    /**
     * Device inputs list
     *
     * Use like this object:
     * {
     *    'group.portname': Port.standart(),
     *    'group.portname': Port.standart()
     * }
     *
    */
    inputs(): {
        [key: string]: BasicPort;
    };
    /**
     * Device output list
     *
     * @see inputs
    */
    outputs(): {
        [key: string]: BasicPort;
    };
    /**
     * The method is an input point to start device initialization
     *
     * The device will only go through the following device creation steps:
     *
     * - Creating a class
     * - Assigning device prameters
     *
     * Must be used to assign functions to call dynamic ports
     * of the device.
    */
    preProcess(): void;
    /**
     * The method is an input point for the start of device operation
     *
     * The device will go through the following steps to create the device:
     *
     * - Creating a class
     * - Assigning device prameters
     * - Creating ports
     * - Assigning call functions
     * - Creating connections between devices
     * - Linking device Shares
     *
     * Must be used to start basic operation of the device
     * e.g. initialization of connections, creation of timers, etc.
    */
    process(): void;
    /**
     * Similar to `process` but asynchronous, the loader will wait for the execution of all the
     * `processPromise` methods of all devices.
     *
     * Used when there is a need to execute before starting the rack
     * and wait for asynchronous code to execute (initialization of some file databases, etc.)
    */
    processPromise(): Promise<void>;
    /**
     * Myby todo?
     *
     * stop() { return }
     * async stopPromise() { return }
    */
    /**
     * Queues device shares data updates for external consumers
     *
     * @see shares
    */
    render(): boolean;
    /**
     * Save device storage
     *
     * @see storage
    */
    save(): boolean;
    /**
     * Write metric value
     *
     * @param path Registered metric path
     * @param value value record
     * @param modify Write modify 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'
    */
    metric(path: string, value: number, modify?: 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    terminal(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    notify(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    event(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    alert(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    error(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * Make & emit device event
     *
     * @param type event type
     * @param data event data string
     * @param trace additional information
    */
    protected makeEvent(type: string, data: string, trace: {
        [key: string]: any;
    }, args: any[]): boolean;
    /**
     * Adding processing for the incoming port
     *
     * @param name Port name in 'port.name' format
     * @param action CallBack function to execute
    */
    addInputHandler(name: string, action: (data: any) => any): void;
    /**
     * Adding a handle for the action
     *
     * @param name Action name in the format 'action.name'
     * @param action CallBack function to execute
    */
    addActionHandler(name: string, action: (data: any) => any): void;
    /**
     * Informs the rack that the unit cannot continue to operate.
     * and a critical error has occurred
     *
     * Requires DeviceError to be created
    */
    terminate(error: Error, action: string): boolean;
}
export {};
