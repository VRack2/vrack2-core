"use strict";
/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const IvMs_1 = __importDefault(require("./IvMs"));
const IvS_1 = __importDefault(require("./IvS"));
const IvUs_1 = __importDefault(require("./IvUs"));
class Metric {
    /**
     * Creating a new metric with minimum time unit in Seconds
    */
    static inS() { return new IvS_1.default(); }
    /**
     * Creating a new metric with minimum time unit in Milliseconds
    */
    static inMs() { return new IvMs_1.default(); }
    /**
     * Creating a new metric with minimum time unit in Microsecond
    */
    static inUs() { return new IvUs_1.default(); }
}
exports.default = Metric;
