"use strict";
/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const DeviceManager_1 = __importDefault(require("./boot/DeviceManager"));
const ErrorManager_1 = __importDefault(require("./errors/ErrorManager"));
const CoreError_1 = __importDefault(require("./errors/CoreError"));
const Validator_1 = __importDefault(require("./validator/Validator"));
const Rule_1 = __importDefault(require("./validator/Rule"));
const Utility_1 = __importDefault(require("./Utility"));
const ImportManager_1 = __importDefault(require("./ImportManager"));
const fs_1 = require("fs");
/***** ********      LOADER ERROR      ********************/
ErrorManager_1.default.registerMany('ServiceLoader', [
    {
        short: 'SLDR_ERROR_INIT_DEVICE',
        description: 'Device initialization error',
        rules: { deviceConfig: Rule_1.default.object().description('Device configuration') }
    },
    {
        short: 'SLDR_ERROR_INIT_CONNECTION',
        description: 'Connection initialization error',
        rules: { connection: Rule_1.default.string().description('Connection string') }
    },
    {
        short: 'SLDR_CONF_EXTENDS_PROBLEM',
        description: 'Problem with extending service configuration.'
    },
    {
        short: 'SLDR_INCORRECT_DEVICE_ID',
        description: 'Incorrect device id'
    },
    {
        short: 'SLDR_ERROR_PREPARE_OPTIONS',
        description: 'An error occurred while preparing options',
        rules: { message: Rule_1.default.string().description('Exception error string') }
    },
]);
/**
 * Сборка сервиса из JSON.
 *
 * Владеет конфигом сервиса: находит классы устройств (`vendor.Class`),
 * проверяет опции, создаёт устройства, соединяет порты, добавляет/удаляет
 * устройства в работающем сервисе и эмитит `service.loaded` — сигнал
 * «структура изменилась», который запускает сохранение структуры.
 *
 * **`Container`** при этом владеет регистрацией, состоянием соединений,
 * ступенчатым стартом и runtime-действиями (`registerDevice`,
 * `addConnection`, `startDevice`, ...). Лоадер создаётся вместе с Container
 * и структурой сервиса; `load()` материализует все устройства и соединения
 * и эмитит `service.loaded`.
 *
 * @example
 * ```js
 * import ServiceLoader, Container from 'vrack2-core'
 *
 * const c = new Container('main')
 * const loader = new ServiceLoader(c, serviceJson)
 * await loader.load()
 * ```
 */
class ServiceLoader {
    constructor(container, service, confFile) {
        this.Container = container;
        this.Bootstrap = container.Bootstrap;
        this.service = service;
        this.confFile = confFile;
        this.inited = false;
        this.pending = new Set();
    }
    /**
     * Load the full structure from `this.service` into the container.
     *
     * This re-homes the previous `Container.init()`:
     * 1. `service.configure` event, then `fillConfFile()` (override device
     *    options; failures wrapped in `SLDR_CONF_EXTENDS_PROBLEM`).
     * 2. `service.init.begin` / `service.init` events, then for each device:
     *    `device.register` event + `createDevice()` +
     *    `Container.registerDevice()` (failures wrapped in
     *    `SLDR_ERROR_INIT_DEVICE`).
     * 3. `service.init.end` / `service.connect.begin` / `service.connect`
     *    events, then wire every device connection (`service.connection`
     *    event) and `service.connections` entry (failures wrapped in
     *    `SLDR_ERROR_INIT_CONNECTION`).
     * 4. `service.connect.end` event.
     * 5. **`service.loaded`** — the finalization signal. Listeners such as
     *    `StructureStorage` react to it by persisting the structure once.
     *
     * Idempotent — a second call is a no-op.
     */
    async load() {
        if (this.inited)
            return;
        this.inited = true;
        this.Container.emit('service.configure');
        try {
            this.fillConfFile();
        }
        catch (err) {
            if (err instanceof Error) {
                const ner = ErrorManager_1.default.make('SLDR_CONF_EXTENDS_PROBLEM', {}).setTrace(err).add(err);
                throw ner;
            }
            throw err;
        }
        this.Container.emit('service.init.begin');
        this.Container.emit('service.init');
        for (const device of this.service.devices) {
            try {
                this.Container.emit('device.register', device);
                const dev = await this.createDevice(device);
                this.Container.registerDevice(dev);
            }
            catch (error) {
                const ner = ErrorManager_1.default.make('SLDR_ERROR_INIT_DEVICE', { deviceConfig: device });
                ner.add(error);
                throw ner;
            }
        }
        this.Container.emit('service.init.end');
        this.Container.emit('service.connect.begin');
        this.Container.emit('service.connect');
        for (const device of this.service.devices) {
            if (!device.connections)
                continue;
            for (const conn of device.connections) {
                this.Container.emit('service.connection', conn);
                this.initConnection(conn);
            }
        }
        if (Array.isArray(this.service.connections)) {
            for (const conn of this.service.connections) {
                this.initConnection(conn);
            }
        }
        this.Container.emit('service.connect.end');
        // Structure finalization — triggers persistence (StructureStorage, ...)
        this.Container.emit('service.loaded');
    }
    /**
     * Wire one connection during `load()`, wrapping any failure in
     * `SLDR_ERROR_INIT_CONNECTION` (preserves the original init behavior).
     */
    initConnection(conn) {
        try {
            this.Container.addConnection(conn);
        }
        catch (error) {
            const ner = ErrorManager_1.default.make('SLDR_ERROR_INIT_CONNECTION', { connection: conn });
            if (error instanceof CoreError_1.default)
                ner.add(error);
            throw ner;
        }
    }
    /**
      * Hot-add a device: create it, register it in the container, and emit
      * `device.register` + `device.add` + `service.loaded`.
     *
     * The device is registered (structure, ports, actions, metrics) but is
     * **not** started. Start it with `Container.startDevice(id)`.
     *
     * @param dconf Device configuration
     * @returns The registered (not yet started) device
     */
    async addDevice(dconf) {
        if (dconf.id in this.Container.devices || this.pending.has(dconf.id)) {
            throw ErrorManager_1.default.make('CONT_DEVICE_DUPLICATE');
        }
        this.pending.add(dconf.id);
        try {
            this.Container.emit('device.register', dconf);
            const dev = await this.createDevice(dconf);
            this.Container.registerDevice(dev);
            this.Container.emit('device.add', dconf.id);
            this.Container.emit('service.loaded');
            return dev;
        }
        finally {
            this.pending.delete(dconf.id);
        }
    }
    /**
     * Hot-remove a device from the container and emit `service.loaded`.
     *
     * If the device is running, it is stopped first
     * (`onStop()` + `await onStopAsync()`) and then destroyed
     * (`onDestroy()` + cleanup).
     *
     * @param id Device ID
     */
    async removeDevice(id) {
        await this.Container.removeDevice(id);
        this.pending.delete(id);
        this.Container.emit('service.loaded');
    }
    /**
     * Hot-add a connection and emit `service.loaded`.
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     */
    addConnection(conn) {
        this.Container.addConnection(conn);
        this.Container.emit('service.loaded');
    }
    /**
     * Override device options (and connections) from the conf file.
     *
     * Re-homed from `Container.fillConfFile()`.
     */
    fillConfFile() {
        if (!this.confFile || !(0, fs_1.existsSync)(this.confFile))
            return;
        const conf = ImportManager_1.default.importJSON(this.confFile);
        if (conf.devices === undefined || !Array.isArray(conf.devices))
            conf.devices = [];
        for (const device of conf.devices) {
            if (!device.id || device.options === undefined || typeof device.options !== 'object')
                continue;
            for (const cdev of this.service.devices) {
                if (cdev.id === device.id) {
                    for (const pname in device.options)
                        cdev.options[pname] = device.options[pname];
                    if (device.connections)
                        cdev.connections = device.connections;
                }
            }
        }
    }
    /**
     * Create and validate a device instance from its configuration.
     *
     * Steps:
     * 1. Resolve the device class via DeviceManager
     * 2. Validate the device id
     * 3. Guard against a duplicate id
     * 4. Instantiate the device
     * 5. Fill & `prepareOptions()`
     * 6. Validate options against `checkOptions()`
     *
     * The returned device is **not** registered in the container.
     *
     * @param dconf Device configuration
     * @returns A validated, unregistered Device instance
     */
    async createDevice(dconf) {
        const DM = this.Bootstrap.getBootClass('DeviceManager', DeviceManager_1.default);
        const cs = await DM.get(dconf.type);
        if (dconf.id === undefined || !dconf.id || typeof dconf.id !== 'string' || !Utility_1.default.isDeviceName(dconf.id)) {
            throw ErrorManager_1.default.make('SLDR_INCORRECT_DEVICE_ID');
        }
        // Device id is duplicated
        if (dconf.id in this.Container.devices)
            throw ErrorManager_1.default.make('CONT_DEVICE_DUPLICATE');
        // Create device instance (not yet registered)
        const dev = new cs(dconf.id, dconf.type, this.Container);
        // Fill options
        for (const key in dconf.options)
            dev.options[key] = dconf.options[key];
        // try prepare options
        try {
            dev.prepareOptions();
        }
        catch (error) {
            let message = '';
            if (error instanceof Error)
                message = error.toString();
            const ner = ErrorManager_1.default.make('SLDR_ERROR_PREPARE_OPTIONS', { message });
            if (error instanceof CoreError_1.default)
                ner.add(error);
            throw ner;
        }
        // Validating
        const rules = dev.checkOptions();
        Validator_1.default.validate(rules, dev.options);
        return dev;
    }
    /**
     * Dry-run validation of a device configuration.
     *
     * Builds a throwaway instance to exercise `prepareOptions()` and option
     * validation, then discards it. It has **no side effects** on the container
     * (nothing is registered).
     *
     * > Device constructors and `prepareOptions()` should be side-effect free.
     *
     * @param dconf Device configuration
     * @returns `ICheckResult` describing validity (and problems, if any)
     */
    async checkDevice(dconf) {
        try {
            await this.createDevice(dconf);
            return { valid: true };
        }
        catch (error) {
            return this.toResult(error);
        }
    }
    /**
     * Dry-run validation of a connection (delegates to Container).
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     * @returns `ICheckResult` describing validity
     */
    checkConnection(conn) {
        return this.Container.checkConnection(conn);
    }
    /**
     * Convert a thrown error into an `ICheckResult`
     */
    toResult(error) {
        if (error instanceof CoreError_1.default) {
            const res = { valid: false, error: { code: error.vShort, message: error.message } };
            const problems = error.problems;
            if (Array.isArray(problems) && problems.length)
                res.problems = problems;
            return res;
        }
        return {
            valid: false,
            error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) }
        };
    }
}
exports.default = ServiceLoader;
