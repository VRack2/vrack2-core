import Bootstrap, { mergeBootList } from "./Bootstrap";
import type { IBootListConfig } from "./Bootstrap";
import Container from "./Container";
import ServiceLoader from "./ServiceLoader";
import IServiceStructure from "./IServiceStructure";
import ImportManager from "./ImportManager";
import { existsSync } from "fs";

interface IMainProcessInternalOptions {
    /** Container ID  */
    id: string;
    /** Service structure */
    service: IServiceStructure;
    /** Path to extends conf file */
    confFile? : string; 
    /** Container class */
    ContainerClass: typeof Container;
    /** Bootstrap list config */
    bootstrap: IBootListConfig
}

export interface IMainProcessOptions {
    /** Container ID  */
    id: string;
    /** Service structure */
    service: IServiceStructure;
    /** Path to extends conf file */
    confFile? : string; 
    /** Container class */
    ContainerClass?: typeof Container;
    /** Bootstrap list config */
    bootstrap?: IBootListConfig
}

export default class MainProcess  {
    /**
     * Core default boot class set (lowest priority layer in the merge).
     */
    static readonly DEFAULT_BOOTLIST: IBootListConfig = {
        DeviceManager: { path: 'vrack2-core.DeviceManager', options: { storageDir: './storage' }},
        DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: {} },
        StructureStorage: { path: 'vrack2-core.StructureStorage', options: {} },
        DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} }
    }
    Container: Container
    Loader: ServiceLoader
    options: IMainProcessInternalOptions = {
        id: 'vrack2',
        service: { 
            devices:[] , 
            connections:[],
        },
        ContainerClass: Container,
        bootstrap: MainProcess.DEFAULT_BOOTLIST
    }
    Bootstrap: Bootstrap
    constructor(config: IMainProcessOptions){
        Object.assign(this.options, config)
        // Merge bootstrap layers, low → high priority:
        // core defaults → service file → conf file → constructor argument.
        // The conf file `bootstrap` section is merged into
        // `service.bootstrap` by `ServiceLoader.fillConfFile()` before this
        // constructor runs, so the service layer already carries the conf
        // overrides at that point.
        this.options.bootstrap = mergeBootList([
            MainProcess.DEFAULT_BOOTLIST,
            this.options.service.bootstrap,
            this.readConfBootstrap(),
            config.bootstrap,
        ])
        this.Bootstrap = new Bootstrap(this.options.bootstrap)
        // Container is a pure runtime container (no service / confFile)
        this.Container = new this.options.ContainerClass(this.options.id, this.Bootstrap)
        // ServiceLoader owns config loading, device creation, hot mutations
        // and the `serviceLoaded` finalization event
        this.Loader = new ServiceLoader(this.Container, this.options.service, this.options.confFile)
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
    private readConfBootstrap(): IBootListConfig | null {
        const cf = this.options.confFile
        if (!cf || !existsSync(cf)) return null
        const conf = ImportManager.importJSON(cf)
        if (conf.bootstrap == null || typeof conf.bootstrap !== 'object') return null
        return conf.bootstrap as IBootListConfig
    }

    async run (){
        await this.check()
        await this.Container.runProcess()
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
    async terminate (){
        await this.Container.stopAll()
    }

    async check(){
        await this.Bootstrap.loadBootList(this.Container)
        await this.Loader.load()
    }
}