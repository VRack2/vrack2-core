import Device from "./service/Device";
import Bootstrap from "./Bootstrap";
import type Container from "./Container";
import IServiceStructure from "./IServiceStructure";
import IStructureDevice from "./IStructureDevice";
import ICheckResult from "./ICheckResult";
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
export default class ServiceLoader {
    /** Container this loader builds devices for */
    Container: Container;
    /** Bootstrap (DeviceManager, etc.) used to resolve device classes */
    Bootstrap: Bootstrap;
    /** Service structure (devices + connections) this loader loads */
    service: IServiceStructure;
    /** Optional conf file that overrides device options */
    confFile?: string;
    /** True after `load()` has run once (idempotency guard) */
    inited: boolean;
    /** Guard against concurrent adds of the same device id */
    pending: Set<string>;
    constructor(container: Container, service: IServiceStructure, confFile?: string);
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
    load(): Promise<void>;
    /**
     * Wire one connection during `load()`, wrapping any failure in
     * `SLDR_ERROR_INIT_CONNECTION` (preserves the original init behavior).
     */
    private initConnection;
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
    addDevice(dconf: IStructureDevice): Promise<Device>;
    /**
     * Hot-remove a device from the container and emit `service.loaded`.
     *
     * If the device is running, it is stopped first
     * (`onStop()` + `await onStopAsync()`) and then destroyed
     * (`onDestroy()` + cleanup).
     *
     * @param id Device ID
     */
    removeDevice(id: string): Promise<void>;
    /**
     * Hot-add a connection and emit `service.loaded`.
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     */
    addConnection(conn: string): void;
    /**
     * Override device options (and connections) from the conf file.
     *
     * Re-homed from `Container.fillConfFile()`.
     */
    protected fillConfFile(): void;
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
    createDevice(dconf: IStructureDevice): Promise<Device>;
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
    checkDevice(dconf: IStructureDevice): Promise<ICheckResult>;
    /**
     * Dry-run validation of a connection (delegates to Container).
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     * @returns `ICheckResult` describing validity
     */
    checkConnection(conn: string): ICheckResult;
    /**
     * Convert a thrown error into an `ICheckResult`
     */
    protected toResult(error: any): ICheckResult;
}
