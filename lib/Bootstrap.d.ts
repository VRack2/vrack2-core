import BootClass from './boot/BootClass';
import Container from './Container';
/**
 * Defines a list of bootstrap classes to load
 *
 * {
 *   'ClassID': {
 *      path: 'importclass.path',
 *      options: {}
 *    }
 * }
*/
export interface IBootListConfig {
    [key: string]: {
        /** VRack-style bootclass path */
        path: string;
        /** Options for this bootclass */
        options: {
            [key: string]: any;
        };
    };
}
/**
 * Bootstrap is a class for running bootclasses,
 * which should work above Container and is required
 * for Container to work.
 *
 * For example DeviceManager class - it is
 * necessary for Container to work but it must be
 * replaceable and customizable.
 *
 * Bootstrap handles the loading of DeviceManager and
 * provides the ability to work with it from Container.
 * Bootclasses are a forced exception.
 *
 * This is the minimum code that is needed to do everything
 * else in the style of VRack service.
 *
*/
export default class Bootstrap {
    /**
     * Loaded class list
     *
     * ```ts
     * { UniqueID: Classinstance }
     * ```
    */
    protected loaded: {
        [key: string]: BootClass;
    };
    /**
     * List of downloadable classes and their settings
     *
     * @see IBootListConfig
    */
    protected config: IBootListConfig;
    constructor(config: IBootListConfig);
    /**
     * Load bootclasses
     *
     * Bootclass has some analogy to devices within VRack services.
     * They also have options, process, processPromise methods similar to devices
     *
     * @param Container Container for which loading is performed
    */
    loadBootList(Container: Container): Promise<void>;
    /**
     * Getting an initialized class
     *
     * @example
     * ```ts
     * this.Container.Bootstrap.getBootClass('DeviceMetrics', DeviceMetrics) as DeviceMetrics
     * ```
     *
     * @param id class identifier that was specified in the list
     * @param cs Class to be compared with when receiving
    */
    getBootClass(id: string, cs: any): any;
}
