"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BasicType_1 = __importDefault(require("../validator/types/BasicType"));
/**
 * Port basic class.  Used internally to define device ports.
*/
class BasicPort {
    constructor() {
        this.port = {
            type: 'unknown',
            description: '',
            required: false,
            dynamic: false,
            count: 0
        };
    }
    /**
     * Sets this port to dynamic
     *
     * If you specify a port to be dynamic, you must specify the number of those ports.
     * Also if you specify a port as dynamic, you must specify `%d` in the name,
     * which will be replaced by the port number.
     *
     * @example
     * ```ts
     * {
     *   'command%d': Port.return().dynamic(this.options.inputs)
     * }
     * ```
     *
     * @param count Count of ports
    */
    dynamic(count) {
        this.port.count = count;
        this.port.dynamic = true;
        return this;
    }
    /**
     * Specifies a recommendation to the data passing through the port.
     * This data is not actually validated by these rules,
     * but these rules can be used in the documentation to clarify perception.
     *
     * @param req BasicType type
    */
    requirement(req) {
        this.port.requirement = req;
        return this;
    }
    /**
     * Port descriptions
    */
    description(des) {
        this.port.description = des;
        return this;
    }
    /**
     * Exports the port data.
     * Collects all data into an IPort object.
     * Internal types of type BasicType are also exported to the corresponding properties
     *
     * @see IPort
     *
     * !hide for external users
     * @private
    */
    export() {
        const nPort = {
            type: this.port.type,
            description: this.port.description,
            required: this.port.required,
            dynamic: this.port.dynamic,
            count: this.port.count
        };
        if (this.port.requirement instanceof BasicType_1.default)
            nPort.requirement = this.port.requirement.export();
        if (this.port.return instanceof BasicType_1.default)
            nPort.return = this.port.return.export();
        return nPort;
    }
}
exports.default = BasicPort;
