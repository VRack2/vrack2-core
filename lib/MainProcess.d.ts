import Bootstrap, { IBootListConfig } from "./Bootstrap";
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
    Container: Container;
    Loader: ServiceLoader;
    options: IMainProcessInternalOptions;
    Bootstrap: Bootstrap;
    constructor(config: IMainProcessOptions);
    run(): Promise<void>;
    check(): Promise<void>;
}
export {};
