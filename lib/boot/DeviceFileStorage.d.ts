import BootClass from "./BootClass";
import BasicType from "../validator/types/BasicType";
/**
 * File storage for devices that are used by default
 * Uses container events to load and save storage state
 *
*/
export default class DeviceFileStorage extends BootClass {
    checkOptions(): {
        [key: string]: BasicType;
    };
    process(): void;
    /**
     * loading a device storage file
     * If the primary storage file does not exist, an attempt will be made
     * to locate the backup temporary storage file.
     *
     * @param deviceId Device ID
     * @returns {any} Imported JSON
    */
    loadDeviceStorage(deviceId: string): Promise<any>;
    /**
     * Save data device to storage
     * First, a temporary file is created,
     * and then the temporary file is copied to the main file
     *
     * @param deviceId Device ID
     * @param trace Data object for storage
    */
    saveDeviceStorage(deviceId: string, trace: any): Promise<void>;
    /**
     * Forms the path to the storage file
     *
     * @param deviceId Device ID
     * @param prefix Prefix between the device name and its extension
    */
    protected makeDeviceStoragePath(deviceId: string, prefix?: string): string;
}
