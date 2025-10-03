/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import path from "path"
import fs from 'fs';
import ImportManager from "../ImportManager";
import BootClass from "./BootClass";
import BasicType from "../validator/types/BasicType";
import Rule from "../validator/Rule";

/**
 * File storage for devices that are used by default
 * Uses container events to load and save storage state
 * 
*/
export default class DeviceFileStorage extends BootClass {

    checkOptions(): { [key: string]: BasicType; } {
        return {
            storageDir: Rule.string().require().default('./storage')
                .description('Dir for storage files')
        }
    }

    process(): void {
        if (!ImportManager.isDir(this.options.storageDir)) fs.mkdirSync(this.options.storageDir, { recursive: true })
        
        // Before process load storage data
        this.Container.on('beforeProcess', () => {
            for (const id in this.Container.devices) {
                try {
                    this.Container.devices[id].storage = this.loadDeviceStorage(id)
                } catch (error) {
                    this.Container.emit('system.error', error)
                }
            }
        })

        // On device save - save storage data
        this.Container.on('device.save', (data: { device: string, data: string, trace: any }) => {
            try {
                this.saveDeviceStorage(data.device, data.trace)
            } catch (error) {
                this.Container.emit('system.error', error)
            }
        })
    }

    /**
     * loading a device storage file
     * If the primary storage file does not exist, an attempt will be made 
     * to locate the backup temporary storage file.
     * 
     * @param deviceId Device ID
     * @returns {any} Imported JSON
    */
    async loadDeviceStorage(deviceId: string) {
        const fp = this.makeDeviceStoragePath(deviceId)
        const fptmp = this.makeDeviceStoragePath(deviceId, '-tmp')
        if (!fs.existsSync(fp)) {
            if (!fs.existsSync(fptmp)) return {}
            fs.renameSync(fptmp, fp)
        }
        return ImportManager.importJSON(fp)
    }

    /**
     * Save data device to storage
     * First, a temporary file is created, 
     * and then the temporary file is copied to the main file
     * 
     * @param deviceId Device ID
     * @param trace Data object for storage
    */
    async saveDeviceStorage(deviceId: string, trace: any) {
        const fp = this.makeDeviceStoragePath(deviceId)
        const dp = path.join(this.options.storageDir, this.Container.id)
        const fptmp = this.makeDeviceStoragePath(deviceId, '-tmp')
        if (!fs.existsSync(dp)) { fs.mkdirSync(dp, { recursive: true }) }
        fs.writeFileSync(fptmp, JSON.stringify(trace))
        if (fs.existsSync(fp)) fs.rmSync(fp)
        fs.renameSync(fptmp, fp)
    }

    /**
     * Forms the path to the storage file
     * 
     * @param deviceId Device ID
     * @param prefix Prefix between the device name and its extension 
    */
    protected makeDeviceStoragePath(deviceId: string, prefix = '') {
        return path.join(this.options.storageDir, this.Container.id, deviceId + prefix + '.json')
    }
}