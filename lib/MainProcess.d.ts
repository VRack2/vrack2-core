import Bootstrap from "./Bootstrap";
import type { IBootListConfig } from "./Bootstrap";
import Container from "./Container";
import ServiceLoader from "./ServiceLoader";
import IServiceStructure from "./IServiceStructure";
interface IMainProcessInternalOptions {
    /** Container ID  */
    id: string;
    /** Service structure */
    service: IServiceStructure;
    /** Path to extends conf file */
    confFile?: string;
    /** Container class */
    ContainerClass: typeof Container;
    /** Bootstrap list config */
    bootstrap: IBootListConfig;
}
export interface IMainProcessOptions {
    /** Container ID  */
    id: string;
    /** Service structure */
    service: IServiceStructure;
    /** Path to extends conf file */
    confFile?: string;
    /** Container class */
    ContainerClass?: typeof Container;
    /** Bootstrap list config */
    bootstrap?: IBootListConfig;
}
export default class MainProcess {
    /**
     * Core default boot class set (lowest priority layer in the merge).
     */
    static readonly DEFAULT_BOOTLIST: IBootListConfig;
    Container: Container;
    Loader: ServiceLoader;
    options: IMainProcessInternalOptions;
    Bootstrap: Bootstrap;
    constructor(config: IMainProcessOptions);
    /**
     * Read the `bootstrap` section of the conf file (if any).
     *
     * Returns `null` when there is no conf file or the `bootstrap` key is
     * absent — `mergeBootList` skips nullish layers.
     *
     * This section is the **3rd layer** in the merge:
     * `core defaults → service file → conf file → constructor argument`.
     */
    private readConfBootstrap;
    run(): Promise<void>;
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
    terminate(): Promise<void>;
    check(): Promise<void>;
}
export {};
