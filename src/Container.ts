import EventEmitter from "events";
import DeviceManager from "./boot/DeviceManager";

import ErrorManager from "./errors/ErrorManager";
import IServiceStructure from "./IServiceStructure";
import IStructureDevice from "./IStructureDevice";
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
import Utility from "./Utility";
import { existsSync } from "fs";

/***** ********      DEVICE ERROR      ********************/

ErrorManager.register('Container', 'FBDRkSAWnlcc', 'CTR_ERROR_INIT_DEVICE', 'Device initialization error', {
    deviceConfig: Rule.object().description('Device configuration')
})

ErrorManager.register('Container', '96UX24PTyFU7', 'CTR_ERROR_INIT_CONNECTION', 'Connection initialization error', {
    connection: Rule.string().description('Connection string')
})

ErrorManager.register('Container', '0HVa3cO1E2vB', 'CTR_INCORRECT_DEVICE_ID', 'Incorrect device id', {})
ErrorManager.register('Container', 'uF62e07wloS9', 'CTR_DEVICE_DUBLICATE', 'Device id is dublicated', {})
ErrorManager.register('Container', '2RZznI3JDNUW', 'CTR_ERROR_PREPARE_OPTIONS', 'An error occurred while preparing options', {
    message: Rule.string().description('Exception error string')
})

ErrorManager.register('Container', 'NDW2oD7mFxqB', 'CTR_DEVICE_ACTION_NF', 'Action on device not found', {
    device: Rule.string().description('Device ID'),
    action: Rule.string().description('Action name'),
    method: Rule.string().description('Method name'),
})

ErrorManager.register('Container', 'XOXLMVCN9OBI', 'CTR_DEVICE_NF', 'Device in container found', {
    device: Rule.string().description('Device ID'),
})

ErrorManager.register('Container', '570RD59JEYVN', 'CTR_DEVICE_ACTION_HANDLER_NF', 'Device handler action not found', {
    device: Rule.string().description('Device ID'),
    action: Rule.string().description('Device action name'),
})

ErrorManager.register('Container', 'RJV0KT2DFZBZ', 'CTR_DEVICE_PROCESS_EXCEPTION', 'During process execution - the device threw an exception', {
    device: Rule.string().description('Device ID'),
})

ErrorManager.register('Container', 'K65XWSYOBVFG', 'CTR_DEVICE_PROCESS_PROMISE_EXCEPTION', 'During processPromise execution - the device threw an exception', {
    device: Rule.string().description('Device ID'),
})


/***** ********      PORTS ERROR      ********************/

ErrorManager.register('Container', 'jkIpU1p4z5uz', 'CTR_INCORRECT_DYNAMIC_PN', 'Incorrect dynamic port name', {
    port: Rule.string().description('Incorrect port name')
})

ErrorManager.register('Container', 'e8m8dUVVOEU7', 'CTR_INCORRECT_PN', 'Incorrect port name', {
    port: Rule.string().description('Incorrect port name')
})

ErrorManager.register('Container', 'qPevPU6SRJ18', 'CTR_INPUT_HANDLER_NF', 'Port input handler not found', {
    port: Rule.string().description('Port name for handler'),
    handler: Rule.string().description('Handler name')
})


ErrorManager.register('Container', 'QlcUh744VzAG', 'CTR_DEVICE_PORT_NF', 'Port on device not found', {
    port: Rule.string().description('Port name'),
})

/***** ********      CONNECTION ERROR      ********************/

ErrorManager.register('Container', 'Kp74OuVGNU0u', 'CTR_CONNECTION_INCORRECT', 'Incorrect connection format', {
    connection: Rule.string().description('Connection string'),
    error: Rule.string().description('String of error problem'),
})

ErrorManager.register('Container', 'eMrJEISxvali', 'CTR_CONNECTION_DEVICE_NF', 'Connection device not found', {
    connection: Rule.string().description('Connection string'),
    device: Rule.string().description('Device name not found')
})

ErrorManager.register('Container', 'CwFj1G47H45E', 'CTR_CONNECTION_PORT_NF', 'Connection port not found', {
    connection: Rule.string().description('Connection string'),
    port: Rule.string().description('Port name not found')
})

ErrorManager.register('Container', 'XR1K10R0OOUC', 'CTR_INCOMPATIBLE_PORTS', 'Incompatible ports', {
    connection: Rule.string().description('Connection string'),
})


ErrorManager.register('Container', 'MmVoDOQwaYkx', 'CTR_INCORRECT_BOOSTRAP', 'The required DeviceManager class is not specified correctly', {})
ErrorManager.register('Container', 'e090R0MLyb7y', 'CTR_CONF_EXTENDS_PROBLEM', 'Problem with extending service configuration.', {})


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
 * Service Load Class. It loads all devices in the list,
 * establishes connections between them, and performs device startup. 
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
     * Path to extended conf file for init loading 
     * @see fillConfFile()
     * */
    confFile?: string

    /**
     * Container bootstrap class
     * 
     * A different bootstrap class must be created for each container
    */
    Bootstrap: Bootstrap

    /** inited flag */
    protected inited = false

    /** run flag */
    protected runned = false

    /**
     * Service structure config
     * 
     * @see constructor
    */
    protected service: IServiceStructure

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
     * Create container needed service structure & device manager
     * 
     * @param service Service structure
     * @param bootstrap Bootstrap class Object 
     * 
     * */
    constructor(id: string, service: IServiceStructure, Bootstrap: Bootstrap, confFile?: string) {
        super()
        this.id = id
        this.service = service
        this.deviceActions = {}
        this.deviceMetrics = {}
        this.confFile = confFile
        this.Bootstrap = Bootstrap
    }

    /**
     * Run container
    */
    async run() {
        await this.init()
        await this.runProcess()
    }

    /**
     * Extends service from config file
     * 
     * Sometimes there is a need to override the settings of some devices.
     * To do this, you can use a special configuration file of the service. 
     * It contains the same as the main service file and replaces with its settings
     * and parameters the settings and parameters of the main service.
     * 
     * @see init()
    */
    protected fillConfFile() {
        if (!this.confFile || !existsSync(this.confFile)) return
        const conf = ImportManager.importJSON(this.confFile)
        if (conf.devices === undefined || !Array.isArray(conf.devices)) conf.devices = []
        for (const device of conf.devices) {
            if (!device.id || device.options === undefined || typeof device.options !== 'object') continue
            for (const cdev of this.service.devices) {
                if (cdev.id === device.id) {
                    for (const pname in device.options) cdev.options[pname] = device.options[pname]
                    if (device.connections) cdev.connections = device.connections
                }
            }
        }
    }


    /**
     * Creates device classes. Preprocesses the device, 
     * then adds ports to it and creates connections between ports.
     * 
     * When adding and creating devices, ports and connections, 
     * the service structure is also created
     *  
     * 1. Init device
     * 2. Init individual device connections
     * 3. Init other connections
     * 
     * @see structure
    */
    async init() {
        if (this.inited) return
        this.inited = true
        this.emit('configure')
        try {
            this.fillConfFile()
        } catch (err) {
            if (err instanceof Error) {
                const ner = ErrorManager.make('CTR_CONF_EXTENDS_PROBLEM', {}).setTrace(err as Error).add(err)
                throw ner
            }
            throw err
        }
        this.emit('beforeInit')
        this.emit('init')
        for (const device of this.service.devices) {
            try {
                this.emit('initDevice', device)
                await this.initDevice(device)
            } catch (error ) {
                const ner = ErrorManager.make('CTR_ERROR_INIT_DEVICE', { deviceConfig: device })
                ner.add(error as Error)
                throw ner
            }
        }
        this.emit('afterInit')
        this.emit('beforeConnections')
        this.emit('connections')
        for (const device of this.service.devices) {
            if (!device.connections) continue
            for (const conn of device.connections) {
                this.emit('connection',conn)
                this.initConnection(conn)
            }
        }

        if (Array.isArray(this.service.connections)) {
            for (const conn of this.service.connections) { 
                
                this.initConnection(conn)
            }
        }
        this.emit('afterConnections')
    }

    /**
     * Run process & processPromise of all devices
    */
    async runProcess() {
        if (this.runned) return
        this.runned = true
        this.emit('beforeProcess')
        for (const key in this.devices) {
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
            try {
                this.emit('processPromise', key)
                await this.devices[key].processPromise()
            } catch (error) {
                throw ErrorManager.make('CTR_DEVICE_PROCESS_PROMISE_EXCEPTION', { device: key }).add(error as Error)
            }
        }
        this.emit('afterProcessPromise')
        this.emit('beforeLoaded')
        this.emit('loaded')
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
     * Init one device
     * 
     * 1. Make device class object
     * 2. Fill device options
     * 3. Run device prepareOptions method
     * 4. Validating device options
     * 5. Check device actions
     * 6. make device inputs ports
     * 7. make device outputs ports
     **/
    protected async initDevice(dconf: IStructureDevice) {
        const DM = this.Bootstrap.getBootClass('DeviceManager', DeviceManager) as DeviceManager
        const cs = await DM.get(dconf.type)
        // 
        if (dconf.id === undefined || !dconf.id || typeof dconf.id !== 'string' || !Utility.isDeviceName(dconf.id)) {
            throw ErrorManager.make('CTR_INCORRECT_DEVICE_ID')
        }
        // Device id is dublicated
        if (dconf.id in this.devices) throw ErrorManager.make('CTR_DEVICE_DUBLICATE')

        // Create device
        const dev = new cs(dconf.id, dconf.type, this) as Device
        this.devices[dconf.id] = dev

        // Fill options
        for (const key in dconf.options) dev.options[key] = dconf.options[key]

        // try prepare options
        try {
            dev.prepareOptions()
        } catch (error) {
            let message = ''
            if (error instanceof Error) message = error.toString()
            const ner = ErrorManager.make('CTR_ERROR_PREPARE_OPTIONS', { message })
            if (error instanceof CoreError) ner.add(error)
            throw ner
        }

        const rules = dev.checkOptions()
        // Validating
        Validator.validate(rules, dev.options)

        /** create structure */
        this.structure[dconf.id] = {
            id: dconf.id,
            type: dconf.type,
            actions: {},
            outputs: {},
            inputs: {},
            ports: [],
            settings: {},
            metrics: {},
        }

        dev.preProcess()

        // Check actions 
        this.deviceActions[dev.id] = dev.actions()
        for (const action in this.deviceActions[dev.id]) {
            const method = ImportManager.camelize('action.' + action)
            if (!(method in dev)) throw ErrorManager.make('CTR_DEVICE_ACTION_NF', { action, method })
            // add structure device action
            this.structure[dconf.id].actions[action] = this.deviceActions[dev.id][action].export()
        }

        this.structure[dconf.id].settings = dev.settings()

        // Make Metrics
        this.deviceMetrics[dev.id] = dev.metrics()
        for (const metric in this.deviceMetrics[dev.id]) {
            const raw = this.deviceMetrics[dev.id][metric].export()
            const nEvent: IDeviceEvent = { device: dev.id, data: metric, trace: raw }
            this.emit('device.register.metric', nEvent)
            this.structure[dconf.id].metrics[metric] = raw
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
                const ndp = new DevicePort(subkey, pList[subkey])
                dev.ports.input[subkey] = ndp
                // add structure device input ports
                this.structure[dconf.id].inputs[subkey] = []
                this.structure[dconf.id].ports.push(
                    Object.assign({ port: subkey, direct: 'input' }, pList[subkey])
                )
                if (handler in dev) ndp.push = dev[handler].bind(dev)
            }
        }

        // make output ports
        const oPorts = dev.outputs()
        for (const key in oPorts) {
            const exp = oPorts[key].export()
            const pList = this.getPortList(key, exp)
            for (const subkey in pList) {
                this.checkPortName(subkey)
                const ndp = new DevicePort(subkey, pList[subkey])
                dev.ports.output[subkey] = ndp
                // add structure device output ports
                this.structure[dconf.id].outputs[subkey] = []
                this.structure[dconf.id].ports.push(
                    Object.assign({ port: subkey, direct: 'output' }, pList[subkey])
                )
            }
        }
    }

    /**
     * Check device input handler 
     * Make CTR_INPUT_HANDLER_NF error if not exists
     * @see initDevice make inputPorts
    */
    protected checkInputHandler(port: string, handler: string, device: Device) {
        if (!(handler in device)) throw ErrorManager.make('CTR_INPUT_HANDLER_NF', { port, handler })
    }


    /**
     * Init device connection
     * 
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
    */
    protected initConnection(conn: string) {
        try {
            const cc = this.toConnection(conn)
            this.emit('connection',cc)
            if (!(cc.outputDevice in this.devices)) throw ErrorManager.make('CTR_CONNECTION_DEVICE_NF', { connection: conn, device: cc.outputDevice })
            if (!(cc.outputPort in this.devices[cc.outputDevice].ports.output)) throw ErrorManager.make('CTR_CONNECTION_PORT_NF', { connection: conn, port: cc.outputPort })

            if (!(cc.inputDevice in this.devices)) throw ErrorManager.make('CTR_CONNECTION_DEVICE_NF', { connection: conn, device: cc.inputDevice })
            if (!(cc.inputPort in this.devices[cc.inputDevice].ports.input)) throw ErrorManager.make('CTR_CONNECTION_PORT_NF', { connection: conn, port: cc.inputPort })

            if (this.devices[cc.inputDevice].ports.input[cc.inputPort].type !== this.devices[cc.outputDevice].ports.output[cc.outputPort].type) throw ErrorManager.make('CTR_INCOMPATIBLE_PORTS', { connection: conn })

            const outPort = this.devices[cc.outputDevice].ports.output[cc.outputPort]
            const inPort = this.devices[cc.inputDevice].ports.input[cc.inputPort]

            // Set structure connections
            if (this.structure[cc.outputDevice].outputs[cc.outputPort] === undefined) this.structure[cc.outputDevice].outputs[cc.outputPort] = []
            this.structure[cc.outputDevice].outputs[cc.outputPort].push({ device: cc.inputDevice, port: cc.inputPort })
            if (this.structure[cc.inputDevice].inputs[cc.inputPort] === undefined) this.structure[cc.inputDevice].inputs[cc.inputPort] = []
            this.structure[cc.inputDevice].inputs[cc.inputPort].push({ device: cc.outputDevice, port: cc.outputPort })
            new DeviceConnect(outPort, inPort)
        } catch (error) {
            const ner = ErrorManager.make('CTR_ERROR_INIT_CONNECTION', { connection: conn })
            if (error instanceof CoreError) ner.add(error)
            throw ner
        }
    }

    /**
     * Container Helper - parse connection string to format object
     * 
     * @return Connection object
    */
    private toConnection(con: string) {
        const act = con.split('->')
        if (act.length !== 2) throw ErrorManager.make('CTR_CONNECTION_INCORRECT', { connection: con, error: "Syntax connection error, syntax have -> beetwen device" })

        const outputDeviceActs = act[0].split('.')
        const inputDeviceActs = act[1].split('.')

        if (outputDeviceActs.length > 3 || inputDeviceActs.length > 3) throw ErrorManager.make('CTR_CONNECTION_INCORRECT', { connection: con, error: "Syntax connection error, syntax have more 3 actets on side" })
        if (outputDeviceActs.length < 2 || inputDeviceActs.length < 2) throw ErrorManager.make('CTR_CONNECTION_INCORRECT', { connection: con, error: "Syntax connection error, syntax have less 2 actets on side" })

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
     * Check Port name (strict format a-zA-Z0-9.)
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