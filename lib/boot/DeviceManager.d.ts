import CoreError from '../errors/CoreError';
import BootClass from './BootClass';
import BasicType from '../validator/types/BasicType';
import IAction from '../actions/IAction';
import IMetricSettings from '../metrics/IMetricSettings';
import IPort from '../ports/IPort';
import IValidationRule from '../validator/IValidationRule';
export interface IDeviceVendor {
    /** Group name = Vendor name  */
    name: string;
    /** Global devices dir */
    dir: string;
    /**
     * List of all devices in group
     * Like a
     *
     * ```
     * ['Device1', 'Device2', 'Device3', 'Device4']
     * ```
    */
    deviceList: Array<string>;
    /**
     * Errors in group
     * Contains all errors collected in the group during initialization
     *
     * Errors like a DM_LIST_NOT_FOUND & DM_LIST_INCORRECT
    */
    errors: Array<CoreError>;
    /**
     * Not used now
     * Vendor description
    */
    description: string;
}
/**
 * An object based on this interface contains all
 * the basic exported information about the device
 *
 * @see getDeviceInfo
*/
export interface IDeivceInfo {
    /** List of device actions    */
    actions: {
        [key: string]: IAction;
    };
    /** List of device metrics */
    metrics: {
        [key: string]: IMetricSettings;
    };
    /** List of device inputs */
    inputs: {
        [key: string]: IPort;
    };
    /** List of device outputs */
    outputs: {
        [key: string]: IPort;
    };
    /** List of device options rules */
    options: {
        [key: string]: IValidationRule;
    };
    /** Device descriotion */
    description: string;
}
/**
 * BootClass which generates a list of available devices for the container.
 * Provides the ability to initialize devices and provide information about them
 *
 *
 * @see get
*/
export default class DeviceManager extends BootClass {
    /**
     * Contains a list of devices and their full path to the class
     * Like a:
     *
     * ```js
     * {
     *     "vendorname.Devicename": '/path/to/js/file.js'
     * }
     * ```
     * */
    protected devices: Map<string, string>;
    /**
     * Vendor array.
     *
     * @see IDeviceVendor
    */
    protected vendorList: Array<IDeviceVendor>;
    checkOptions(): {
        [key: string]: BasicType;
    };
    process(): void;
    /**
     * Return vendor list
     *
     * @example
     * ```ts
     * ['vrack', 'basic', 'net']
     * ```
    */
    getVendorList(): string[];
    /**
     * Returns a list of devices from a specific vendor
     *
     * @param vendor Vendor name
     * @see getVendorList()
    */
    getVendorDeviceList(vendor: string): Array<string>;
    /**
     * Exports all basic device parameters and collects them in one object
     * Used to generate documentation for the device
     *
     * @see IDeivceInfo
    */
    getDeviceInfo(vendor: string, device: string): Promise<IDeivceInfo>;
    /**
     * Method for updating the device list
     * Updates the available device lists.
     *
     * Searches the directory specified in `options.dir` and adds all directories in it as vendors.
     * Each folder attempts to read the list.json file to get a list of vendor devices
     *
     * Two types of list.json file definition are supported
     *
     * First type - array:
     *
     * ```json
     * ['Device1', 'Device2', 'Device3']
     * ```
     * Second type - Object
     * This approach allows you to point to devices that are deeper than the vendor's root folder
     *
     * ```json
     * {
     *   "Master": "devices/Master",
     *   "Interval": "devices/Interval",
     *   "Guard": "devices/Guard",
     * }
     * ```
     *
     * @see arrayDeviceListPrepare()
     * @see objectDeviceListPrepare()
    */
    protected updateDeviceList(): void;
    /**
     * Return class of device
     *
     * Requires special device string of path
     * example "vrack.System" where "vrack" is vendor and "System" is device class
     * @param {string} device Device path string
    */
    get(device: string, updateList?: boolean): Promise<any>;
    /**
     * Find vendor by name
     *
     * Not found if return boolean
    */
    protected findVendor(vendor: string): boolean | IDeviceVendor;
    /**
     * Processes a list of devices as an Array
     *
     * Takes an Array of type
     * ```
     * ['DeviceName', 'DeviceName2']
     * ```
     * @return {Array<string>} Sorted list
    */
    protected arrayDeviceListPrepare(list: Array<string>, group: IDeviceVendor): string[];
    /**
     * Processes a list of devices as an object
     *
     * Takes an object of type
     * ```
     * {
     *  DeviceName: 'path/to/Device'
     * }
     * ```
     *
     * return keys of list
     * ```
     * ['DeviceName']
     * ```
     *
     * Set in this.devices for device name requiere path
    */
    protected objectDeviceListPrepare(list: {
        [key: string]: string;
    }, group: IDeviceVendor): string[];
}
