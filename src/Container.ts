import EventEmitter from "events";
import ICheckResult from "./ICheckResult";

import ErrorManager from "./errors/ErrorManager";
import Device from "./service/Device";
import Rule from "./validator/Rule";
import CoreError from "./errors/CoreError";
import Validator from "./validator/Validator";
import BasicAction from "./actions/BasicAction";
import ImportManager from "./ImportManager";
import DevicePort from "./service/DevicePort";

import IPort from "./ports/IPort";
import DeviceConnect from "./service/DeviceConnect";
import IAction from "./actions/IAction";
import Bootstrap from "./Bootstrap";
import IMetricSettings from "./metrics/IMetricSettings";
import BasicMetric from "./metrics/BasicMetric";
import IDeviceEvent from "./service/IDeviceEvent";

/***** ********      DEVICE ERROR      ********************/

ErrorManager.registerMany('Container', [
    {
        short: 'CTR_DEVICE_DUPLICATE',
        description: 'Device id is duplicated'
    },
    {
        short: 'CTR_DEVICE_ACTION_NF',
        description: 'Action on device not found',
        rules: {
            device: Rule.string().description('Device ID'),
            action: Rule.string().description('Action name'),
            method: Rule.string().description('Method name'),
        }
    },
    {
        short: 'CTR_DEVICE_NF',
        description: 'Device in container NOT found',
        rules: { device: Rule.string().description('Device ID') }
    },
    {
        short: 'CTR_DEVICE_ACTION_HANDLER_NF',
        description: 'Device handler action not found',
        rules: {
            device: Rule.string().description('Device ID'),
            action: Rule.string().description('Device action name'),
        }
    },
    {
        short: 'CTR_DEVICE_PROCESS_EXCEPTION',
        description: 'During process execution - the device threw an exception',
        rules: { device: Rule.string().description('Device ID') }
    },
    {
        short: 'CTR_DEVICE_PROCESS_PROMISE_EXCEPTION',
        description: 'During processPromise execution - the device threw an exception',
        rules: { device: Rule.string().description('Device ID') }
    },
    {
        short: 'CTR_DEVICE_STOP_EXCEPTION',
        description: 'During stop execution - the device threw an exception',
        rules: { device: Rule.string().description('Device ID') }
    },
    {
        short: 'CTR_DEVICE_STOP_PROMISE_EXCEPTION',
        description: 'During stopPromise execution - the device threw an exception',
        rules: { device: Rule.string().description('Device ID') }
    },
    {
        short: 'CTR_DEVICE_STOP_ALL_EXCEPTION',
        description: 'During stopAll execution - one or more devices failed to stop'
    },
    {
        short: 'CTR_DEVICE_STOPPED',
        description: 'Device is not running - the action is rejected',
        rules: {
            device: Rule.string().description('Device ID'),
            action: Rule.string().description('Device action name'),
        }
    },
])


/***** ********      PORTS ERROR      ********************/

ErrorManager.registerMany('Container', [
    {
        short: 'CTR_INCORRECT_DYNAMIC_PN',
        description: 'Incorrect dynamic port name',
        rules: { port: Rule.string().description('Incorrect port name') }
    },
    {
        short: 'CTR_INCORRECT_PN',
        description: 'Incorrect port name',
        rules: { port: Rule.string().description('Incorrect port name') }
    },
    {
        short: 'CTR_INPUT_HANDLER_NF',
        description: 'Port input handler not found',
        rules: {
            port: Rule.string().description('Port name for handler'),
            handler: Rule.string().description('Handler name')
        }
    },
    {
        short: 'CTR_DEVICE_PORT_NF',
        description: 'Port on device not found',
        rules: { port: Rule.string().description('Port name') }
    },
])

/***** ********      CONNECTION ERROR      ********************/

ErrorManager.registerMany('Container', [
    {
        short: 'CTR_CONNECTION_INCORRECT',
        description: 'Incorrect connection format',
        rules: {
            connection: Rule.string().description('Connection string'),
            error: Rule.string().description('String of error problem'),
        }
    },
    {
        short: 'CTR_CONNECTION_DEVICE_NF',
        description: 'Connection device not found',
        rules: {
            connection: Rule.string().description('Connection string'),
            device: Rule.string().description('Device name not found')
        }
    },
    {
        short: 'CTR_CONNECTION_PORT_NF',
        description: 'Connection port not found',
        rules: {
            connection: Rule.string().description('Connection string'),
            port: Rule.string().description('Port name not found')
        }
    },
    {
        short: 'CTR_INCOMPATIBLE_PORTS',
        description: 'Incompatible ports',
        rules: { connection: Rule.string().description('Connection string') }
    },
    {
        short: 'CTR_INCORRECT_BOOTSTRAP',
        description: 'The required DeviceManager class is not specified correctly'
    },
    {
        short: 'CTR_IGNORE_SERVICE_AUTORELOAD',
        description: 'Error that ignores service restart flag'
    },
])



/**
 * Contains the structure of the service
 * 
 * Where { DeviceID: DeviceStructure }
*/
export interface IContainerStructure {
    [key: string]: {
        /** Device ID */
        id: string;
        /** Device type like a 'vendor.Device'*/
        type: string;
        /** Actions list @see IAction */
        actions: { [key: string]: IAction };
        /** List of ports with their connections  */
        outputs: { [key: string]: Array<{ device: string, port: string }> };
        /** List of ports with their connections  */
        inputs: { [key: string]: Array<{ device: string, port: string }> };
        /** List of all ports on the device */
        ports: Array<IDeviceStructurePort>;
        /** A list of device metrics */
        metrics: { [key: string]: IMetricSettings }
        /** Device display settings */
        settings: { [key: string]: any };
        /** Personalized display settings */
        display?: {
            header_bg?: string,
            body_bg?: string,
            group_bg?: string,
            is_rotated?: boolean,
            row?: number,
            col?: number
        }
    }
}
export interface IDeviceStructurePort extends IPort {
    /** Port ID */
    port: string,
    /** Port direct */
    direct: string,
}

/**
 * Pure runtime container.
 *
 * Holds the device registry, the live `structure`, connection state
 * and the staged start. It does **not** own the service config or device
 * creation — those belong to `ServiceLoader`.
 * 
 * This class is a bit complicated for a simple description. 
 * It is recommended to familiarize yourself with the source code
*/
export default class Container extends EventEmitter {

    /** Unique service ID */
    id = '';

    /** List of devices in container */
    devices: { [key: string]: Device } = {}

    /** Parent container if it exists */
    parent?: Container

    /**
     * Дополнительные метаданные
    */
    meta?: {[key: string]: any}

    /**
     * Container bootstrap class
     * 
     * A different bootstrap class must be created for each container
    */
    Bootstrap: Bootstrap

    /** run flag */
    protected runned = false

    /**
     * List of all device actions
     * 
     * [deviceID]: { action.name: BasicAction}
    */
    protected deviceActions: { [key: string]: { [key: string]: BasicAction } }

    /**
     * List of all device metrics
     * 
    */
    protected deviceMetrics: { [key: string]: { [key: string]: BasicMetric } }

    /** 
     * Container structure 
    */
    protected structure: IContainerStructure = {}

    /**
     * Set of device ids that are fully started
     * (`process()` + `processPromise()` completed).
     * Used to make `startDevice()` idempotent.
    */
    protected started: Set<string> = new Set()

    /**
     * Create a pure runtime container.
     *
     * The container holds the device registry, the live `structure`,
     * connection state and the staged start. It does **not** own the service
     * config or device creation — those belong to `ServiceLoader`.
     *
     * @param id Container ID
     * @param bootstrap Bootstrap class object
     */
    constructor(id: string, bootstrap: Bootstrap) {
        super()
        this.id = id
        this.deviceActions = {}
        this.deviceMetrics = {}
        this.Bootstrap = bootstrap
    }

    /**
     * Run process & processPromise of all devices
     *
     * Staged start: first `process()` of every (not yet started) device,
     * then `processPromise()` of every (not yet started) device.
     * Devices that were already started via `startDevice()` are skipped,
     * which makes this method safe to call after hot adds.
    */
    async runProcess() {
        if (this.runned) return
        this.runned = true
        this.emit('beforeProcess')
        for (const key in this.devices) {
            if (this.started.has(key)) continue
            this.devices[key].running = true
            try {
                this.emit('process',key)
                this.devices[key].process()
            } catch (error) {
                throw ErrorManager.make('CTR_DEVICE_PROCESS_EXCEPTION', { device: key }).add(error as Error)
            }
        }
        this.emit('afterProcess')
        this.emit('beforeProcessPromise')
        for (const key in this.devices) {
            if (this.started.has(key)) continue
            try {
                this.emit('processPromise', key)
                await this.devices[key].processPromise()
            } catch (error) {
                throw ErrorManager.make('CTR_DEVICE_PROCESS_PROMISE_EXCEPTION', { device: key }).add(error as Error)
            }
            this.started.add(key)
        }
        this.emit('afterProcessPromise')
        this.emit('beforeLoaded')
        this.emit('loaded')
    }

    /**
     * Start a single (already registered) device: run `process()` and then
     * `processPromise()`.
     *
     * Idempotent — calling it again for the same device is a no-op.
     * Used to hot-start a device that was added via `addDevice()`.
     *
     * @param id Device ID
    */
    async startDevice(id: string): Promise<void> {
        if (!(id in this.devices)) throw ErrorManager.make('CTR_DEVICE_NF', { device: id })
        if (this.started.has(id)) return
        this.devices[id].running = true
        try {
            this.emit('process', id)
            this.devices[id].process()
        } catch (error) {
            throw ErrorManager.make('CTR_DEVICE_PROCESS_EXCEPTION', { device: id }).add(error as Error)
        }
        try {
            this.emit('processPromise', id)
            await this.devices[id].processPromise()
        } catch (error) {
            throw ErrorManager.make('CTR_DEVICE_PROCESS_PROMISE_EXCEPTION', { device: id }).add(error as Error)
        }
        this.started.add(id)
    }

    /**
     * Stop a single running device: call `stop()`, then `await stopPromise()`,
     * then mark it stopped (`running = false`, removed from `started`).
     *
     * Reversible — the device can be started again with `startDevice()`.
     * Idempotent — a device that is not running is a no-op.
     *
     * @param id Device ID
     */
    async stopDevice(id: string): Promise<void> {
        if (!(id in this.devices)) throw ErrorManager.make('CTR_DEVICE_NF', { device: id })
        if (!this.started.has(id)) return
        const dev = this.devices[id]
        try {
            this.emit('stop', id)
            dev.stop()
        } catch (error) {
            throw ErrorManager.make('CTR_DEVICE_STOP_EXCEPTION', { device: id }).add(error as Error)
        }
        try {
            await dev.stopPromise()
        } catch (error) {
            throw ErrorManager.make('CTR_DEVICE_STOP_PROMISE_EXCEPTION', { device: id }).add(error as Error)
        }
        this.started.delete(id)
        dev.running = false
    }

    /**
     * Stop all running devices in the reverse order of their start.
     *
     * Best-effort: every running device is stopped even if some of them fail;
     * if nothing is running this is a no-op.
     * If one or more devices failed, throws CTR_DEVICE_STOP_ALL_EXCEPTION
     * with each device error attached (`vAddErrors`).
     *
     * Stopped devices can be started again with `startDevice()`.
     */
    async stopAll(): Promise<void> {
        const ids = [...this.started].reverse()
        const errors: Error[] = []
        this.emit('beforeStop')
        for (const id of ids) {
            try {
                await this.stopDevice(id)
            } catch (error) {
                errors.push(error as Error)
            }
        }
        this.emit('afterStop')
        if (errors.length > 0) {
            let ner = ErrorManager.make('CTR_DEVICE_STOP_ALL_EXCEPTION')
            for (const error of errors) ner = ner.add(error)
            throw ner
        }
    }

    /**
     * Whether a device has been fully started (`process` + `processPromise`).
     *
     * @param id Device ID
    */
    isStarted(id: string): boolean {
        return this.started.has(id)
    }

    /**
     * Check device action and run him
     * 
     * @param device Device ID
     * @param action Device action (as 'action.name')
     * @param data Data for action
    */
    async deviceAction(device: string, action: string, data: any) {
        if (!this.deviceActions[device]) throw ErrorManager.make('CTR_DEVICE_NF', { device })
        if (!this.started.has(device)) throw ErrorManager.make('CTR_DEVICE_STOPPED', { device, action })
        const deviceClass = this.devices[device]
        const deviceActions = this.deviceActions[device]
        const method = ImportManager.camelize('action.' + action)
        if (!deviceActions[action]) throw ErrorManager.make('CTR_DEVICE_ACTION_NF', { device, action, method })
        if (!deviceClass[method as keyof Device]) throw ErrorManager.make('CTR_DEVICE_ACTION_HANDLER_NF', { device, action })
        const actionExport = deviceActions[action].exportRaw()
        Validator.validate(actionExport.requirements, data)
        return await deviceClass[method as keyof Device](data)
    }

    /**
     * Return structure
    */
    async getStructure() {
        return this.structure
    }

    /**
     * Register a previously created & validated device instance into the
     * container:
     *  - add to the devices map
     *  - create the structure entry
     *  - run `preProcess()`
     *  - attach auto-render of `shares` (`attachSharesRender()`)
     *  - register actions
     *  - register metrics (emit `device.register.metric`)
     *  - create input & output ports
     *
     * @param dev A device created via `ServiceLoader.createDevice()`
     * @returns The registered device
    */
    registerDevice(dev: Device): Device {
        this.devices[dev.id] = dev

        /** create structure */
        this.structure[dev.id] = {
            id: dev.id,
            type: dev.type,
            actions: {},
            outputs: {},
            inputs: {},
            ports: [],
            settings: {},
            metrics: {},
        }

        dev.preProcess()

        // Auto-render: from this point on any `shares` change emits `device.render`
        dev.attachSharesRender()

        // Check actions 
        this.deviceActions[dev.id] = dev.actions()
        for (const action in this.deviceActions[dev.id]) {
            const method = ImportManager.camelize('action.' + action)
            if (!(method in dev)) throw ErrorManager.make('CTR_DEVICE_ACTION_NF', { action, method })
            // add structure device action
            this.structure[dev.id].actions[action] = this.deviceActions[dev.id][action].export()
        }

        this.structure[dev.id].settings = dev.settings()

        // Make Metrics
        this.deviceMetrics[dev.id] = dev.metrics()
        for (const metric in this.deviceMetrics[dev.id]) {
            const raw = this.deviceMetrics[dev.id][metric].export()
            const nEvent: IDeviceEvent = { device: dev.id, data: metric, trace: raw }
            this.emit('device.register.metric', nEvent)
            this.structure[dev.id].metrics[metric] = raw
        }

        // make inputPorts
        const iPorts = dev.inputs()
        for (const key in iPorts) {
            const exp = iPorts[key].export()
            const pList = this.getPortList(key, exp)
            for (const subkey in pList) {
                this.checkPortName(subkey)
                const handler = ImportManager.camelize('input.' + subkey) as keyof Device
                this.checkInputHandler(subkey, handler, dev)
                const ndp = new DevicePort(subkey, pList[subkey], dev)
                dev.ports.input[subkey] = ndp
                // add structure device input ports
                this.structure[dev.id].inputs[subkey] = []
                this.structure[dev.id].ports.push(
                    Object.assign({ port: subkey, direct: 'input' }, pList[subkey])
                )
                
                // биндимся а не заменяем push для контроля внутри push
                if (handler in dev) ndp.bind = dev[handler].bind(dev)
            }
        }

        // make output ports
        const oPorts = dev.outputs()
        for (const key in oPorts) {
            const exp = oPorts[key].export()
            const pList = this.getPortList(key, exp)
            for (const subkey in pList) {
                this.checkPortName(subkey)
                const ndp = new DevicePort(subkey, pList[subkey], dev)
                dev.ports.output[subkey] = ndp
                // add structure device output ports
                this.structure[dev.id].outputs[subkey] = []
                this.structure[dev.id].ports.push(
                    Object.assign({ port: subkey, direct: 'output' }, pList[subkey])
                )
            }
        }

        return dev
    }

    /**
     * Check device input handler 
     * Make CTR_INPUT_HANDLER_NF error if not exists
     * @see registerDevice make inputPorts
    */
    protected checkInputHandler(port: string, handler: string, device: Device) {
        if (!(handler in device)) throw ErrorManager.make('CTR_INPUT_HANDLER_NF', { port, handler })
    }


    /**
     * Parse & validate a connection string against the current container
     * state. Pure check — emits no events, commits nothing.
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
     * @returns The parsed connection
    */
    protected checkConnectionCore(conn: string) {
        const cc = this.toConnection(conn)
        if (!(cc.outputDevice in this.devices)) throw ErrorManager.make('CTR_CONNECTION_DEVICE_NF', { connection: conn, device: cc.outputDevice })
        if (!(cc.outputPort in this.devices[cc.outputDevice].ports.output)) throw ErrorManager.make('CTR_CONNECTION_PORT_NF', { connection: conn, port: cc.outputPort })

        if (!(cc.inputDevice in this.devices)) throw ErrorManager.make('CTR_CONNECTION_DEVICE_NF', { connection: conn, device: cc.inputDevice })
        if (!(cc.inputPort in this.devices[cc.inputDevice].ports.input)) throw ErrorManager.make('CTR_CONNECTION_PORT_NF', { connection: conn, port: cc.inputPort })

        if (this.devices[cc.inputDevice].ports.input[cc.inputPort].type !== this.devices[cc.outputDevice].ports.output[cc.outputPort].type) throw ErrorManager.make('CTR_INCOMPATIBLE_PORTS', { connection: conn })
        return cc
    }

    /**
     * Commit a validated connection: update the structure and create the
     * `DeviceConnect`. Does not emit (the caller emits `connection`).
     *
     * @param cc Parsed connection (from `checkConnectionCore`)
    */
    protected makeConnection(cc: { outputDevice: string, outputPort: string, inputDevice: string, inputPort: string }) {
        const outPort = this.devices[cc.outputDevice].ports.output[cc.outputPort]
        const inPort = this.devices[cc.inputDevice].ports.input[cc.inputPort]

        // Set structure connections
        if (this.structure[cc.outputDevice].outputs[cc.outputPort] === undefined) this.structure[cc.outputDevice].outputs[cc.outputPort] = []
        this.structure[cc.outputDevice].outputs[cc.outputPort].push({ device: cc.inputDevice, port: cc.inputPort })
        if (this.structure[cc.inputDevice].inputs[cc.inputPort] === undefined) this.structure[cc.inputDevice].inputs[cc.inputPort] = []
        this.structure[cc.inputDevice].inputs[cc.inputPort].push({ device: cc.outputDevice, port: cc.outputPort })
        new DeviceConnect(outPort, inPort)
    }

    /**
     * Add a connection between two already-registered device ports.
     *
     * This is the hot-connection entry point. Validates the connection,
     * emits `connection`, updates the structure and creates the
     * `DeviceConnect`. Throws the specific VRack error on failure.
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
    */
    addConnection(conn: string) {
        const cc = this.checkConnectionCore(conn)
        this.emit('connection', cc)
        this.makeConnection(cc)
    }

    /**
     * Dry-run validation of a connection (no side effects, no `DeviceConnect`).
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
     * @returns `ICheckResult` describing validity
    */
    checkConnection(conn: string): ICheckResult {
        try {
            this.checkConnectionCore(conn)
            return { valid: true }
        } catch (error) {
            return this.toCheckResult(error)
        }
    }

    /**
     * Convert a thrown error into an `ICheckResult`
    */
    protected toCheckResult(error: any): ICheckResult {
        if (error instanceof CoreError) {
            const res: ICheckResult = { valid: false, error: { code: error.vShort, message: error.message } }
            const problems = (error as any).problems
            if (Array.isArray(problems) && problems.length) res.problems = problems
            return res
        }
        return {
            valid: false,
            error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) }
        }
    }

    /**
     * Remove a device from the container:
     *  - stop it first, if it is running: `stop()` + `await stopPromise()`
     *  - call `beforeTerminate()`
     *  - disconnect all its connections (both sides)
     *  - remove its structure entry and all references to it
     *  - remove it from the devices / actions / metrics maps & `started`
     *  - emit `device.remove` (device id)
     *
     * The device is destroyed — unlike `stopDevice()`, it cannot be
     * started again. If the stop hooks fail, the removal is aborted and
     * the device stays in the container (fail-closed).
     *
     * The device's storage file is intentionally left on disk.
     *
     * @param id Device ID
    */
    async removeDevice(id: string): Promise<void> {
        if (!(id in this.devices)) throw ErrorManager.make('CTR_DEVICE_NF', { device: id })
        const dev = this.devices[id]

        // 0. Detach auto-render: stop/termination mutations must not render
        dev.detachSharesRender()

        // 1. Stop the device first, if it is running
        // (no await at all for a not started device — the body stays synchronous)
        if (this.started.has(id)) await this.stopDevice(id)
        // a removed device never accepts port data again
        dev.running = false

        // 2. Termination hook
        dev.beforeTerminate()

        // 2. Disconnect all connections touching this device (both sides)
        const ports = [...Object.values(dev.ports.input), ...Object.values(dev.ports.output)]
        const seen = new Set<DeviceConnect>()
        for (const port of ports) {
            for (const conn of [...port.connections]) {
                if (seen.has(conn)) continue
                seen.add(conn)
                conn.outputLink.removeConnection(conn)
                conn.inputLink.removeConnection(conn)
            }
        }

        // 3. Structure: drop the device and every reference to it
        delete this.structure[id]
        for (const oid in this.structure) {
            if (oid === id) continue
            for (const pname in this.structure[oid].outputs) {
                this.structure[oid].outputs[pname] = this.structure[oid].outputs[pname]
                    .filter((t) => t.device !== id)
                if (this.structure[oid].outputs[pname].length === 0) delete this.structure[oid].outputs[pname]
            }
            for (const pname in this.structure[oid].inputs) {
                this.structure[oid].inputs[pname] = this.structure[oid].inputs[pname]
                    .filter((t) => t.device !== id)
                if (this.structure[oid].inputs[pname].length === 0) delete this.structure[oid].inputs[pname]
            }
        }

        // 4. Remove from internal registries
        delete this.devices[id]
        delete this.deviceActions[id]
        delete this.deviceMetrics[id]
        this.started.delete(id)

        // 5. Notify
        this.emit('device.remove', id)
    }

    /**
     * Whether a device with the given id is registered in the container.
     *
     * @param id Device ID
    */
    hasDevice(id: string): boolean {
        return id in this.devices
    }

    /**
     * Get a registered device by id.
     *
     * @param id Device ID
     * @returns The device, or `undefined` if not registered
    */
    getDevice(id: string): Device | undefined {
        return this.devices[id]
    }

    /**
     * List ids of all registered devices.
    */
    deviceList(): string[] {
        return Object.keys(this.devices)
    }

    /**
     * Container Helper - parse connection string to format object
     * 
     * @return Connection object
    */
    private toConnection(con: string) {
        const act = con.split('->')
        if (act.length !== 2) throw ErrorManager.make('CTR_CONNECTION_INCORRECT', { connection: con, error: "Syntax connection error, syntax have -> between device" })

        const outputDeviceActs = act[0].split('.')
        const inputDeviceActs = act[1].split('.')

        if (outputDeviceActs.length > 3 || inputDeviceActs.length > 3) throw ErrorManager.make('CTR_CONNECTION_INCORRECT', { connection: con, error: "Syntax connection error, syntax have more 3 acts on side" })
        if (outputDeviceActs.length < 2 || inputDeviceActs.length < 2) throw ErrorManager.make('CTR_CONNECTION_INCORRECT', { connection: con, error: "Syntax connection error, syntax have less 2 acts on side" })

        let outputDevice = outputDeviceActs.shift()?.trim()
        const outputPort = outputDeviceActs.join('.').trim()
        let inputDevice = inputDeviceActs.shift()?.trim()
        const inputPort = inputDeviceActs.join('.').trim()

        if (outputDevice === undefined) outputDevice = ''
        if (inputDevice === undefined) inputDevice = ''

        const result: {
            outputDevice: string,
            outputPort: string,
            inputDevice: string,
            inputPort: string,
        } = {
            outputDevice, outputPort, inputDevice, inputPort
        }
        return result
    }

    /**
     * Check Port name (must contain at least one a-z, A-Z, 0-9 or '.' character)
     * 
     * @param port Port name
    */
    protected checkPortName(port: string) {
        if (!port.match(/[a-zA-Z0-9.]/)) throw ErrorManager.make('CTR_INCORRECT_PN', { port })
    }

    /**
     * Convert dynamic port to ports list
     * 
     * @param name Port name with %d symbols
     * @param iPort IPort object (port settings)
    */
    protected getPortList(name: string, iPort: IPort) {
        const result: { [key: string]: IPort } = {}
        if (!iPort.dynamic) {
            result[name] = iPort
            return result
        }

        if (!name.match(/%d/)) throw ErrorManager.make('CTR_INCORRECT_DYNAMIC_PN', { port: name })

        for (let i = 1; i <= iPort.count; i++) {
            const nIPort = Object.assign({}, iPort)
            nIPort.count = 0
            nIPort.dynamic = false
            const nname = name.replace(/%d/, i + '')
            result[nname] = nIPort
        }

        return result
    }
}