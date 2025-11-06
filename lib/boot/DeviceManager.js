"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ErrorManager_1 = __importDefault(require("../errors/ErrorManager"));
const Rule_1 = __importDefault(require("../validator/Rule"));
const CoreError_1 = __importDefault(require("../errors/CoreError"));
const BootClass_1 = __importDefault(require("./BootClass"));
const ImportManager_1 = __importDefault(require("../ImportManager"));
ErrorManager_1.default.register('DeviceManager', 'S5dBTBKTnVbF', 'DM_DEVICE_NOT_FOUND', 'Device not found', {
    device: Rule_1.default.string().require().example('Master').description('Device name')
});
ErrorManager_1.default.register('DeviceManager', '2CJSDE95V9O1', 'DM_LIST_NOT_FOUND', 'list.json not found', {
    vendor: Rule_1.default.string().require().example('vrack').description('Device group name')
});
ErrorManager_1.default.register('DeviceManager', 'BPX96F93ZCJA', 'DM_LIST_INCORRECT', 'list.json is not correct', {
    vendor: Rule_1.default.string().require().example('vrack').description('Device group name')
});
ErrorManager_1.default.register('DeviceManager', 'H1NDNVCOLWST', 'DM_VENDOR_NOT_FOUND', 'Vendor not found', {
    vendor: Rule_1.default.string().require().example('vrack').description('Vendor name')
});
ErrorManager_1.default.register('DeviceManager', 'HQ62LW1YLTDE', 'DM_GET_INFO_EXCEPTION', 'Error retrieving device data, see error in attachment', {});
/**
 * BootClass which generates a list of available devices for the container.
 * Provides the ability to initialize devices and provide information about them
 *
 *
 * @see get
*/
class DeviceManager extends BootClass_1.default {
    constructor() {
        super(...arguments);
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
        this.devices = new Map();
        /**
         * Vendor array.
         *
         * @see IDeviceVendor
        */
        this.vendorList = [];
    }
    checkOptions() {
        return {
            dir: Rule_1.default.string().require().default('./devices'),
            systemDir: Rule_1.default.string().require().default(ImportManager_1.default.systemPath()),
        };
    }
    process() {
        this.updateDeviceList();
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
        const result = [];
        for (const dgroup of this.vendorList)
            result.push(dgroup.name);
        return result;
    }
    /**
     * Returns a list of devices from a specific vendor
     *
     * @param vendor Vendor name
     * @see getVendorList()
    */
    getVendorDeviceList(vendor) {
        const vgroup = this.findVendor(vendor);
        if (typeof vgroup === "boolean")
            throw ErrorManager_1.default.make('DM_VENDOR_NOT_FOUND', { vendor }).setTrace(new Error());
        return vgroup.deviceList;
    }
    /**
     * Exports all basic device parameters and collects them in one object
     * Used to generate documentation for the device
     *
     * @see IDeivceInfo
    */
    getDeviceInfo(vendor, device) {
        return __awaiter(this, void 0, void 0, function* () {
            const di = [vendor, device].join('.');
            const DeviceClass = yield this.get(di);
            const dev = new DeviceClass('1', di, this);
            const result = { actions: {}, metrics: {}, inputs: {}, outputs: {}, options: {}, description: '' };
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
                result.description = dev.description();
            }
            catch (error) {
                throw ErrorManager_1.default.make('DM_GET_INFO_EXCEPTION').setTrace(new Error).add(error);
            }
            return result;
        });
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
    updateDeviceList() {
        this.vendorList = [];
        this.devices.clear();
        const dirs = ImportManager_1.default.dirList(path_1.default.join(this.options.systemDir, this.options.dir)).sort();
        for (const vendor of dirs) {
            const group = {
                name: vendor,
                dir: this.options.dir,
                deviceList: [],
                errors: [],
                description: ''
            };
            this.vendorList.push(group);
            const listPath = path_1.default.join(this.options.systemDir, this.options.dir, vendor, 'list.json');
            if (!fs_1.default.existsSync(listPath)) {
                group.errors.push(ErrorManager_1.default.make('DM_LIST_NOT_FOUND', { vendor }).setTrace(new Error));
                continue;
            }
            try {
                const list = JSON.parse(fs_1.default.readFileSync(listPath).toString('utf-8'));
                if (Array.isArray(list)) { // if device list like a [ 'DeviceName', 'DeviceTwo' ]
                    group.deviceList = this.arrayDeviceListPrepare(list, group);
                }
                else if (typeof list === "object") { // if device list lie a { DeviceID?: 'PathToDevice' }
                    group.deviceList = this.objectDeviceListPrepare(list, group);
                }
                else
                    throw new Error();
            }
            catch (err) {
                if (err instanceof CoreError_1.default)
                    group.errors.push(err);
                else
                    group.errors.push(ErrorManager_1.default.make('DM_LIST_INCORRECT', { vendor }).setTrace(new Error));
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
    get(device, updateList = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const p = this.devices.get(device); // return device path or undefined
            if (typeof p === 'string') {
                const deviceClass = yield Promise.resolve(`${p}`).then(s => __importStar(require(s))); // try import
                if (deviceClass.default)
                    return deviceClass.default;
            }
            // Устройство не найдено, но не исключено что если перестроить дерево 
            // вендоров и устройств все будет так же
            // По умолчанию мы попытаемся обновить дерево
            if (updateList) {
                yield this.updateDeviceList();
                return yield this.get(device, false);
            }
            throw ErrorManager_1.default.make('DM_DEVICE_NOT_FOUND', { device });
        });
    }
    /**
     * Find vendor by name
     *
     * Not found if return boolean
    */
    findVendor(vendor) {
        for (const dgroup of this.vendorList)
            if (dgroup.name === vendor)
                return dgroup;
        return false;
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
    arrayDeviceListPrepare(list, group) {
        for (const name of list) {
            const reqPath = path_1.default.join(this.options.systemDir, this.options.dir, group.name, name);
            if (!fs_1.default.existsSync(reqPath + '.js')) {
                group.errors.push(ErrorManager_1.default.make('DM_DEVICE_NOT_FOUND', { device: name }));
            }
            this.devices.set(group.name + '.' + name, reqPath);
        }
        list.sort();
        return list;
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
    objectDeviceListPrepare(list, group) {
        for (const name in list) {
            const reqPath = path_1.default.join(this.options.systemDir, this.options.dir, group.name, list[name]);
            if (!fs_1.default.existsSync(reqPath + '.js')) {
                group.errors.push(ErrorManager_1.default.make('DM_DEVICE_NOT_FOUND', { device: name }).setTrace(new Error));
            }
            this.devices.set(group.name + '.' + name, reqPath);
        }
        return Object.keys(list).sort();
    }
}
exports.default = DeviceManager;
