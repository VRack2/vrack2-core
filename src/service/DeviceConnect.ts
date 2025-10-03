/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import DevicePort from "./DevicePort"

/**
 * Class for connecting device ports
 * Using inside Container class
*/
export default class {
    outputLink: DevicePort
    inputLink: DevicePort

    /**
    */
    constructor(output: DevicePort, input: DevicePort) {
        this.outputLink = output
        this.inputLink = input
        this.outputLink.addConnection(this)
        this.inputLink.addConnection(this)
    }

    /**
     * Handles communication between two device ports
     * @param data Data sent by the device when the push port is invoked
    */
    push(data: any): any {
        return this.inputLink.push(data)
    }
}
