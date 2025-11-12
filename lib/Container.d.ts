/// <reference types="node" />
import EventEmitter from "events";
import IServiceStructure from "./IServiceStructure";
import IStructureDevice from "./IStructureDevice";
import Device from "./service/Device";
import BasicAction from "./actions/BasicAction";
import IPort from "./ports/IPort";
import IAction from "./actions/IAction";
import Bootstrap from "./Bootstrap";
import IMetricSettings from "./metrics/IMetricSettings";
import BasicMetric from "./metrics/BasicMetric";
/**
 * Contains the structure of the service
 *
 * Where { DeviceID: DeviceStructure }
*/
export interface IContainerStructure {
    [key: string]: {
        /** Device ID */
        id: string;
        /** Device type like a 'vendor.Device'*/
        type: string;
        /** Actions list @see IAction */
        actions: {
            [key: string]: IAction;
        };
        /** List of ports with their connections  */
        outputs: {
            [key: string]: Array<{
                device: string;
                port: string;
            }>;
        };
        /** List of ports with their connections  */
        inputs: {
            [key: string]: Array<{
                device: string;
                port: string;
            }>;
        };
        /** List of all ports on the device */
        ports: Array<IDeviceStructurePort>;
        /** A list of device metrics */
        metrics: {
            [key: string]: IMetricSettings;
        };
        /** Device display settings */
        settings: {
            [key: string]: any;
        };
        /** Personalized display settings */
        display?: {
            header_bg?: string;
            body_bg?: string;
            group_bg?: string;
            is_rotated?: boolean;
            row?: number;
            col?: number;
        };
    };
}
export interface IDeviceStructurePort extends IPort {
    /** Port ID */
    port: string;
    /** Port direct */
    direct: string;
}
/**
 * Service Load Class. It loads all devices in the list,
 * establishes connections between them, and performs device startup.
 *
 * This class is a bit complicated for a simple description.
 * It is recommended to familiarize yourself with the source code
*/
export default class Container extends EventEmitter {
    /** Unique service ID */
    id: string;
    /** List of devices in container */
    devices: {
        [key: string]: Device;
    };
    /** Parent container if it exists */
    parent?: Container;
    /**
     * Path to extended conf file for init loading
     * @see fillConfFile()
     * */
    confFile?: string;
    /**
     * Дополнительные метаданные
    */
    meta?: {
        [key: string]: any;
    };
    /**
     * Container bootstrap class
     *
     * A different bootstrap class must be created for each container
    */
    Bootstrap: Bootstrap;
    /** inited flag */
    protected inited: boolean;
    /** run flag */
    protected runned: boolean;
    /**
     * Service structure config
     *
     * @see constructor
    */
    protected service: IServiceStructure;
    /**
     * List of all device actions
     *
     * [deviceID]: { action.name: BasicAction}
    */
    protected deviceActions: {
        [key: string]: {
            [key: string]: BasicAction;
        };
    };
    /**
     * List of all device metrics
     *
    */
    protected deviceMetrics: {
        [key: string]: {
            [key: string]: BasicMetric;
        };
    };
    /**
     * Container structure
    */
    protected structure: IContainerStructure;
    /**
     * Create container needed service structure & device manager
     *
     * @param service Service structure
     * @param bootstrap Bootstrap class Object
     *
     * */
    constructor(id: string, service: IServiceStructure, Bootstrap: Bootstrap, confFile?: string);
    /**
     * Run container
    */
    run(): Promise<void>;
    /**
     * Extends service from config file
     *
     * Sometimes there is a need to override the settings of some devices.
     * To do this, you can use a special configuration file of the service.
     * It contains the same as the main service file and replaces with its settings
     * and parameters the settings and parameters of the main service.
     *
     * @see init()
    */
    protected fillConfFile(): void;
    /**
     * Creates device classes. Preprocesses the device,
     * then adds ports to it and creates connections between ports.
     *
     * When adding and creating devices, ports and connections,
     * the service structure is also created
     *
     * 1. Init device
     * 2. Init individual device connections
     * 3. Init other connections
     *
     * @see structure
    */
    init(): Promise<void>;
    /**
     * Run process & processPromise of all devices
    */
    runProcess(): Promise<void>;
    /**
     * Check device action and run him
     *
     * @param device Device ID
     * @param action Device action (as 'action.name')
     * @param data Data for action
    */
    deviceAction(device: string, action: string, data: any): Promise<any>;
    /**
     * Return structure
    */
    getStructure(): Promise<IContainerStructure>;
    /**
     * Init one device
     *
     * 1. Make device class object
     * 2. Fill device options
     * 3. Run device prepareOptions method
     * 4. Validating device options
     * 5. Check device actions
     * 6. make device inputs ports
     * 7. make device outputs ports
     **/
    protected initDevice(dconf: IStructureDevice): Promise<void>;
    /**
     * Check device input handler
     * Make CTR_INPUT_HANDLER_NF error if not exists
     * @see initDevice make inputPorts
    */
    protected checkInputHandler(port: string, handler: string, device: Device): void;
    /**
     * Init device connection
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
    */
    protected initConnection(conn: string): void;
    /**
     * Container Helper - parse connection string to format object
     *
     * @return Connection object
    */
    private toConnection;
    /**
     * Check Port name (strict format a-zA-Z0-9.)
     *
     * @param port Port name
    */
    protected checkPortName(port: string): void;
    /**
     * Convert dynamic port to ports list
     *
     * @param name Port name with %d symbols
     * @param iPort IPort object (port settings)
    */
    protected getPortList(name: string, iPort: IPort): {
        [key: string]: IPort;
    };
}
