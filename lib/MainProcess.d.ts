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
/**
 * Точка входа: корень всей конструкции сервиса.
 *
 * Принимает `id`, `service` (структуру в JSON), `bootstrap` (список
 * служебных модулей) и опционально `ContainerClass` / `confFile`. Создаёт
 * `Bootstrap`, `Container` и `ServiceLoader` и связывает их между собой.
 *
 * `run()` — «собрать» (Bootstrap → ServiceLoader) и «запустить»
 * (Container). `stop()` — graceful-завершение сервиса. Каноническая
 * стартовая последовательность описана в
 * [01-Architecture](docs/01-Architecture.md).
 *
 * @example
 * ```js
 * import MainProcess from 'vrack2-core'
 *
 * const mp = new MainProcess({ id: 'main', service: serviceJson })
 * await mp.run()
 * ```
 */
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
    /**
     * Полный запуск: сборка сервиса и старт устройств.
     *
     * Сначала `check()` (boot-классы + `ServiceLoader.load()`), затем
     * `Container.runStart()`. Идемпотентен: повторный вызов не пересоздаёт
     * уже собранные объекты и не запускает уже стартовавшие устройства.
     *
     * @returns Promise<void>
     *
     * @example
     * ```js
     * await mp.run()
     * ```
     */
    run(): Promise<void>;
    /**
     * Graceful service termination: stops all running devices
     * (`onStop()` + `await onStopAsync()` for each, in reverse start order).
     *
     * The service structure, device registry and storage files remain
     * intact — a new process can load the same service again.
     * The framework does not manage the host process lifecycle (no
      * `process.exit()`) — after `stop()` the host decides what to do.
     *
     * Idempotent: if no device is running, this is a no-op.
     * If one or more devices failed to stop, throws
     * `CONT_DEVICE_STOP_ALL_EXCEPTION` with the device errors attached
     * (`vAddErrors`).
     */
    stop(): Promise<void>;
    /**
     * «Собрать» сервис без запуска устройств: загрузить boot-классы и
     * выполнить `ServiceLoader.load()` (создание устройств, соединения,
     * событие `service.loaded`).
     *
     * Идемпотентен: повторный вызов безопасен.
     *
     * @returns Promise<void>
     */
    check(): Promise<void>;
}
export {};
