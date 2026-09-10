"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Bootstrap_1 = __importDefault(require("./Bootstrap"));
const Container_1 = __importDefault(require("./Container"));
const ServiceLoader_1 = __importDefault(require("./ServiceLoader"));
class MainProcess {
    constructor(config) {
        this.options = {
            id: 'vrack2',
            service: {
                devices: [],
                connections: [],
            },
            ContainerClass: Container_1.default,
            bootstrap: {
                DeviceManager: { path: 'vrack2-core.DeviceManager', options: { storageDir: './storage' } },
                DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: {} },
                StructureStorage: { path: 'vrack2-core.StructureStorage', options: {} },
                DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} }
            }
        };
        Object.assign(this.options, config);
        this.Bootstrap = new Bootstrap_1.default(this.options.bootstrap);
        // Container is a pure runtime container (no service / confFile)
        this.Container = new this.options.ContainerClass(this.options.id, this.Bootstrap);
        // ServiceLoader owns config loading, device creation, hot mutations
        // and the `serviceLoaded` finalization event
        this.Loader = new ServiceLoader_1.default(this.Container, this.options.service, this.options.confFile);
    }
    async run() {
        await this.check();
        await this.Container.runProcess();
    }
    async check() {
        await this.Bootstrap.loadBootList(this.Container);
        await this.Loader.load();
    }
}
exports.default = MainProcess;
