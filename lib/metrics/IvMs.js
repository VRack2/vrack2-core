"use strict";
/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BasicMetric_1 = __importDefault(require("./BasicMetric"));
/**
 * Creating a new metric with minimum time unit in milliseconds
 *
 * @see BasicMetric
*/
class IvMS extends BasicMetric_1.default {
    constructor() {
        super();
        this.metric.interval = 'ms';
    }
}
exports.default = IvMS;
