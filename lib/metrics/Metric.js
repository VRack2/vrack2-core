"use strict";
/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MetricGroup_1 = __importDefault(require("./MetricGroup"));
const MetricOne_1 = __importDefault(require("./MetricOne"));
/**
 * Device metric declarations — factory for the values returned from
 * `Device.metrics()`.
 *
 * Declared under an exact key: `Metric.one()` — a single metric.
 * Declared under a wildcard key (`'group.*'`): `Metric.group()` — a group
 * admitting any name matching the pattern, with optional known members.
 *
 * Declarations carry metadata only (description/additional); storage,
 * retention and the time unit (always ms internally) belong to the metrics
 * engine (`JournalDbMetrics` / `VrackDbMetrics`).
 */
class Metric {
    /**
     * Declare a single metric.
     */
    static one() { return new MetricOne_1.default(); }
    /**
     * Declare a metric group under a wildcard key (e.g. `'boilers.*'`).
     */
    static group() { return new MetricGroup_1.default(); }
}
exports.default = Metric;
