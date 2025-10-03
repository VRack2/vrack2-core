"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Class for connecting device ports
 * Using inside Container class
*/
class default_1 {
    /**
    */
    constructor(output, input) {
        this.outputLink = output;
        this.inputLink = input;
        this.outputLink.addConnection(this);
        this.inputLink.addConnection(this);
    }
    /**
     * Handles communication between two device ports
     * @param data Data sent by the device when the push port is invoked
    */
    push(data) {
        return this.inputLink.push(data);
    }
}
exports.default = default_1;
