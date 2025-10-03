"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
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
const ImportManager_1 = __importDefault(require("../ImportManager"));
const BootClass_1 = __importDefault(require("./BootClass"));
const Rule_1 = __importDefault(require("../validator/Rule"));
/**
 * File storage for devices that are used by default
 * Uses container events to load and save storage state
 *
*/
class DeviceFileStorage extends BootClass_1.default {
    checkOptions() {
        return {
            storageDir: Rule_1.default.string().require().default('./storage')
                .description('Dir for storage files')
        };
    }
    process() {
        if (!ImportManager_1.default.isDir(this.options.storageDir))
            fs_1.default.mkdirSync(this.options.storageDir, { recursive: true });
        // Before process load storage data
        this.Container.on('beforeProcess', () => {
            for (const id in this.Container.devices) {
                try {
                    this.Container.devices[id].storage = this.loadDeviceStorage(id);
                }
                catch (error) {
                    this.Container.emit('system.error', error);
                }
            }
        });
        // On device save - save storage data
        this.Container.on('device.save', (data) => {
            try {
                this.saveDeviceStorage(data.device, data.trace);
            }
            catch (error) {
                this.Container.emit('system.error', error);
            }
        });
    }
    /**
     * loading a device storage file
     * If the primary storage file does not exist, an attempt will be made
     * to locate the backup temporary storage file.
     *
     * @param deviceId Device ID
     * @returns {any} Imported JSON
    */
    loadDeviceStorage(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const fp = this.makeDeviceStoragePath(deviceId);
            const fptmp = this.makeDeviceStoragePath(deviceId, '-tmp');
            if (!fs_1.default.existsSync(fp)) {
                if (!fs_1.default.existsSync(fptmp))
                    return {};
                fs_1.default.renameSync(fptmp, fp);
            }
            return ImportManager_1.default.importJSON(fp);
        });
    }
    /**
     * Save data device to storage
     * First, a temporary file is created,
     * and then the temporary file is copied to the main file
     *
     * @param deviceId Device ID
     * @param trace Data object for storage
    */
    saveDeviceStorage(deviceId, trace) {
        return __awaiter(this, void 0, void 0, function* () {
            const fp = this.makeDeviceStoragePath(deviceId);
            const dp = path_1.default.join(this.options.storageDir, this.Container.id);
            const fptmp = this.makeDeviceStoragePath(deviceId, '-tmp');
            if (!fs_1.default.existsSync(dp)) {
                fs_1.default.mkdirSync(dp, { recursive: true });
            }
            fs_1.default.writeFileSync(fptmp, JSON.stringify(trace));
            if (fs_1.default.existsSync(fp))
                fs_1.default.rmSync(fp);
            fs_1.default.renameSync(fptmp, fp);
        });
    }
    /**
     * Forms the path to the storage file
     *
     * @param deviceId Device ID
     * @param prefix Prefix between the device name and its extension
    */
    makeDeviceStoragePath(deviceId, prefix = '') {
        return path_1.default.join(this.options.storageDir, this.Container.id, deviceId + prefix + '.json');
    }
}
exports.default = DeviceFileStorage;
