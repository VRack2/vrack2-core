import Bootstrap, { IBootListConfig } from "./Bootstrap";
import Container from "./Container";
import IServiceStructure from "./IServiceStructure";

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
    Container: Container
    options: IMainProcessInternalOptions = {
        id: 'vrack2',
        service: { 
            devices:[] , 
            connections:[],
        },
        ContainerClass: Container,
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { storageDir: './storage' }},
            DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: {} },
            StructureStorage: { path: 'vrack2-core.StructureStorage', options: {} },
            DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} }
        }
    }
    Bootstrap: Bootstrap
    constructor(config: IMainProcessOptions){
        Object.assign(this.options, config)
        this.Bootstrap = new Bootstrap(this.options.bootstrap)
        this.Container = new this.options.ContainerClass(this.options.id, this.options.service, this.Bootstrap, this.options.confFile)
    }

    async run (){
        await this.check()
        await this.Container.runProcess()
    }

    async check(){
        await this.Bootstrap.loadBootList(this.Container)
        await this.Container.init()
    }
}