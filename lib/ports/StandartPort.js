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
class StandartPort extends BasicPort_1.default {
    constructor() {
        super();
        this.port.type = 'standart';
    }
}
exports.default = StandartPort;
