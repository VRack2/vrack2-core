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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Bootstrap_1 = __importStar(require("./Bootstrap"));
const Container_1 = __importDefault(require("./Container"));
const ServiceLoader_1 = __importDefault(require("./ServiceLoader"));
const ImportManager_1 = __importDefault(require("./ImportManager"));
const fs_1 = require("fs");
class MainProcess {
    constructor(config) {
        this.options = {
            id: 'vrack2',
            service: {
                devices: [],
                connections: [],
            },
            ContainerClass: Container_1.default,
            bootstrap: MainProcess.DEFAULT_BOOTLIST
        };
        Object.assign(this.options, config);
        // Merge bootstrap layers, low → high priority:
        // core defaults → service file → conf file → constructor argument.
        // The conf file `bootstrap` section is merged into
        // `service.bootstrap` by `ServiceLoader.fillConfFile()` before this
        // constructor runs, so the service layer already carries the conf
        // overrides at that point.
        this.options.bootstrap = (0, Bootstrap_1.mergeBootList)([
            MainProcess.DEFAULT_BOOTLIST,
            this.options.service.bootstrap,
            this.readConfBootstrap(),
            config.bootstrap,
        ]);
        this.Bootstrap = new Bootstrap_1.default(this.options.bootstrap);
        // Container is a pure runtime container (no service / confFile)
        this.Container = new this.options.ContainerClass(this.options.id, this.Bootstrap);
        // ServiceLoader owns config loading, device creation, hot mutations
        // and the `serviceLoaded` finalization event
        this.Loader = new ServiceLoader_1.default(this.Container, this.options.service, this.options.confFile);
    }
    /**
     * Read the `bootstrap` section of the conf file (if any).
     *
     * Returns `null` when there is no conf file or the `bootstrap` key is
     * absent — `mergeBootList` skips nullish layers.
     *
     * This section is the **3rd layer** in the merge:
     * `core defaults → service file → conf file → constructor argument`.
     */
    readConfBootstrap() {
        const cf = this.options.confFile;
        if (!cf || !(0, fs_1.existsSync)(cf))
            return null;
        const conf = ImportManager_1.default.importJSON(cf);
        if (conf.bootstrap == null || typeof conf.bootstrap !== 'object')
            return null;
        return conf.bootstrap;
    }
    async run() {
        await this.check();
        await this.Container.runProcess();
    }
    /**
     * Graceful service termination: stops all running devices
     * (`stop()` + `await stopPromise()` for each, in reverse start order).
     *
     * The service structure, device registry and storage files remain
     * intact — a new process can load the same service again.
     * The framework does not manage the host process lifecycle (no
     * `process.exit()`) — after `terminate()` the host decides what to do.
     *
     * Idempotent: if no device is running, this is a no-op.
     * If one or more devices failed to stop, throws
     * `CTR_DEVICE_STOP_ALL_EXCEPTION` with the device errors attached
     * (`vAddErrors`).
     */
    async terminate() {
        await this.Container.stopAll();
    }
    async check() {
        await this.Bootstrap.loadBootList(this.Container);
        await this.Loader.load();
    }
}
/**
 * Core default boot class set (lowest priority layer in the merge).
 */
MainProcess.DEFAULT_BOOTLIST = {
    DeviceManager: { path: 'vrack2-core.DeviceManager', options: { storageDir: './storage' } },
    DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: {} },
    StructureStorage: { path: 'vrack2-core.StructureStorage', options: {} },
    DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} }
};
exports.default = MainProcess;
