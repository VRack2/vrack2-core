"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BasicPort_1 = __importDefault(require("./BasicPort"));
class ReturnPort extends BasicPort_1.default {
    constructor() {
        super();
        this.port.type = 'return';
    }
    /**
     * Specifies a recommendation to the data return from the port.
     *
     * @param req BasicType type
    */
    return(req) {
        this.port.return = req;
        return this;
    }
}
exports.default = ReturnPort;
