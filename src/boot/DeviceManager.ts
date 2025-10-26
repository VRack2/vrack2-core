import path from 'path'
import fs from 'fs'
import ErrorManager from '../errors/ErrorManager'
import Rule from '../validator/Rule'
import CoreError from '../errors/CoreError'
import BootClass from './BootClass'
import ImportManager from '../ImportManager'
import BasicType from '../validator/types/BasicType'
import Device from '../service/Device'
import IAction from '../actions/IAction'
import IMetricSettings from '../metrics/IMetricSettings'
import IPort from '../ports/IPort'
import IValidationRule from '../validator/IValidationRule'
import Validator from '../validator/Validator'

export interface IDeviceVendor {
    /** Group name = Vendor name  */
    name: string,
    /** Global devices dir */
    dir: string,

    /**
     * List of all devices in group
     * Like a 
     * 
     * ```
     * ['Device1', 'Device2', 'Device3', 'Device4']
     * ```
    */
    deviceList: Array<string>,

    /**
     * Errors in group
     * Contains all errors collected in the group during initialization
     * 
     * Errors like a DM_LIST_NOT_FOUND & DM_LIST_INCORRECT
    */
    errors: Array<CoreError>,

    /**
     * Not used now
     * Vendor description
    */
    description: string
}

/**
 * An object based on this interface contains all 
 * the basic exported information about the device
 * 
 * @see getDeviceInfo
*/
export interface IDeivceInfo {
    /** List of device actions    */
    actions: { [key: string]: IAction }
    /** List of device metrics */
    metrics: { [key: string]: IMetricSettings }
    /** List of device inputs */
    inputs: { [key: string]: IPort }
    /** List of device outputs */
    outputs: { [key: string]: IPort }
    /** List of device options rules */
    options: { [key: string]: IValidationRule }
    /** Device descriotion */
    description: string
}

ErrorManager.register(
    'DeviceManager',
    'S5dBTBKTnVbF',
    'DM_DEVICE_NOT_FOUND',
    'Device not found', {
    device: Rule.string().require().example('Master').description('Device name')
})

ErrorManager.register(
    'DeviceManager',
    '2CJSDE95V9O1',
    'DM_LIST_NOT_FOUND',
    'list.json not found', {
    vendor: Rule.string().require().example('vrack').description('Device group name')
})

ErrorManager.register(
    'DeviceManager',
    'BPX96F93ZCJA',
    'DM_LIST_INCORRECT',
    'list.json is not correct', {
    vendor: Rule.string().require().example('vrack').description('Device group name')
})

ErrorManager.register(
    'DeviceManager',
    'H1NDNVCOLWST',
    'DM_VENDOR_NOT_FOUND',
    'Vendor not found', {
    vendor: Rule.string().require().example('vrack').description('Vendor name')
})

ErrorManager.register('DeviceManager', 'HQ62LW1YLTDE', 'DM_GET_INFO_EXCEPTION', 'Error retrieving device data, see error in attachment', {})


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
    protected devices = new Map<string, string>()

    /**
     * Vendor array.
     * 
     * @see IDeviceVendor
    */
    protected vendorList: Array<IDeviceVendor> = []

    checkOptions(): { [key: string]: BasicType; } {
        return {
            dir: Rule.string().require().default('./devices'),
            systemDir: Rule.string().require().default(ImportManager.systemPath()),
        }
    }

    process(): void {
        this.updateDeviceList()
    }

    /**
     * Return vendor list
     * 
     * @example 
     * ```ts
     * ['vrack', 'basic', 'net']
     * ```
    */
    getVendorList() {
        const result: Array<string> = []
        for (const dgroup of this.vendorList) result.push(dgroup.name)
        return result
    }

    /**
     * Returns a list of devices from a specific vendor
     * 
     * @param vendor Vendor name
     * @see getVendorList()
    */
    getVendorDeviceList(vendor: string): Array<string> {
        const vgroup = this.findVendor(vendor)
        if (typeof vgroup === "boolean") throw ErrorManager.make('DM_VENDOR_NOT_FOUND', { vendor }).setTrace(new Error())
        return vgroup.deviceList
    }

    /**
     * Exports all basic device parameters and collects them in one object
     * Used to generate documentation for the device
     * 
     * @see IDeivceInfo
    */
    async getDeviceInfo(vendor: string, device: string) {
        const di = [vendor, device].join('.')
        const DeviceClass = await this.get(di)
        const dev = new DeviceClass('1', di, this) as Device
        
        // Заполняем значения по умолчанию валидатором
        // Это нужно динамических портов которые определяются через options
        const rules = dev.checkOptions()
        Validator.validate(rules, dev.options)

        const result: IDeivceInfo = { actions: {}, metrics: {}, inputs: {}, outputs: {}, options: {}, description: '' }
        try {
            const preOptions = dev.checkOptions();
            for (const oName in preOptions)
                result.options[oName] = preOptions[oName].export();
            const dInputs = dev.inputs();
            for (const iName in dInputs)
                result.inputs[iName] = dInputs[iName].export();
            const dOutputs = dev.outputs();
            for (const oName in dOutputs)
                result.outputs[oName] = dOutputs[oName].export();
            const dActions = dev.actions();
            for (const aName in dActions)
                result.actions[aName] = dActions[aName].export();
            const dMetrics = dev.metrics();
            for (const mName in dMetrics)
                result.metrics[mName] = dMetrics[mName].export();
            result.description = dev.description()
        } catch (error) {
            throw ErrorManager.make('DM_GET_INFO_EXCEPTION').setTrace(new Error).add(error as Error)
        }
        return result
    }

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
    protected updateDeviceList() {
        this.vendorList = []
        this.devices.clear()
        const dirs = ImportManager.dirList(path.join(this.options.systemDir, this.options.dir)).sort()
        for (const vendor of dirs) {
            const group: IDeviceVendor = {
                name: vendor,
                dir: this.options.dir,
                deviceList: [],
                errors: [],
                description: ''
            }
            this.vendorList.push(group)
            const listPath = path.join(this.options.systemDir, this.options.dir, vendor, 'list.json')
            if (!fs.existsSync(listPath)) { group.errors.push(ErrorManager.make('DM_LIST_NOT_FOUND', { vendor }).setTrace(new Error)); continue }
            try {
                const list: Array<string> = JSON.parse(fs.readFileSync(listPath).toString('utf-8'))
                if (Array.isArray(list)) { // if device list like a [ 'DeviceName', 'DeviceTwo' ]
                    group.deviceList = this.arrayDeviceListPrepare(list, group);
                } else if (typeof list === "object") { // if device list lie a { DeviceID?: 'PathToDevice' }
                    group.deviceList = this.objectDeviceListPrepare(list, group);
                } else throw new Error()
            } catch (err) {
                if (err instanceof CoreError) group.errors.push(err)
                else group.errors.push(ErrorManager.make('DM_LIST_INCORRECT', { vendor }).setTrace(new Error))
            }
        }
    }

    /**
     * Return class of device 
     * 
     * Requires special device string of path 
     * example "vrack.System" where "vrack" is vendor and "System" is device class
     * @param {string} device Device path string
    */
    async get(device: string, updateList = true): Promise<any> {
        const p: string | undefined = this.devices.get(device) // return device path or undefined
        if (typeof p === 'string') {
            const deviceClass = await import(p) // try import
            if (deviceClass.default) return deviceClass.default
        }
        // Устройство не найдено, но не исключено что если перестроить дерево 
        // вендоров и устройств все будет так же
        // По умолчанию мы попытаемся обновить дерево
        if (updateList){
            await this.updateDeviceList()
            return await this.get(device, false)
        }
        throw ErrorManager.make('DM_DEVICE_NOT_FOUND', { device })
    }

    /**
     * Find vendor by name
     * 
     * Not found if return boolean
    */
    protected findVendor(vendor: string): boolean | IDeviceVendor {
        for (const dgroup of this.vendorList) if (dgroup.name === vendor) return dgroup
        return false
    }

    /**
     * Processes a list of devices as an Array
     * 
     * Takes an Array of type 
     * ```
     * ['DeviceName', 'DeviceName2']
     * ```
     * @return {Array<string>} Sorted list
    */
    protected arrayDeviceListPrepare(list: Array<string>, group: IDeviceVendor) {
        for (const name of list) {
            const reqPath = path.join(this.options.systemDir, this.options.dir, group.name, name)
            if (!fs.existsSync(reqPath + '.js')) {
                group.errors.push(ErrorManager.make('DM_DEVICE_NOT_FOUND', { device: name }))
            }
            this.devices.set(group.name + '.' + name, reqPath)
        }
        list.sort()
        return list
    }

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
    protected objectDeviceListPrepare(list: { [key: string]: string }, group: IDeviceVendor) {
        for (const name in list) {
            const reqPath = path.join(this.options.systemDir, this.options.dir, group.name, list[name])
            if (!fs.existsSync(reqPath + '.js')) {
                group.errors.push(ErrorManager.make('DM_DEVICE_NOT_FOUND', { device: name }).setTrace(new Error))
            }
            this.devices.set(group.name + '.' + name, reqPath)
        }
        return Object.keys(list).sort()
    }
}