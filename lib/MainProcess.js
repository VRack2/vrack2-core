"use strict";
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
const Bootstrap_1 = __importDefault(require("./Bootstrap"));
const Container_1 = __importDefault(require("./Container"));
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
        this.Container = new this.options.ContainerClass(this.options.id, this.options.service, this.Bootstrap, this.options.confFile);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.check();
            yield this.Container.runProcess();
        });
    }
    check() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.Bootstrap.loadBootList(this.Container);
            yield this.Container.init();
        });
    }
}
exports.default = MainProcess;
