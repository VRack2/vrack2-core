"use strict";
/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BootClass_1 = __importDefault(require("../BootClass"));
/**
 * Common base class for the device-metrics boot-class engines —
 * `JournalDbMetrics` (disk-backed, `vrack2-journal-db`) and
 * `VrackDbMetrics` (in-memory, `vrack-db`, backward compatibility).
 *
 * It defines the contract every metrics engine exposes to the service:
 * `has()` and `read()` for reading, and the `device.metric` /
 * `device.metric.register` event wiring for writing. The engine-specific
 * parts — the underlying storage, per-metric aggregation, and the exact
 * `read()` result shape — are left to the concrete subclasses.
 *
 * Subclasses extend this instead of {@link BootClass} directly and implement
 * the abstract engine hooks (`has`, `read`, `registerMetric`, `deviceMetric`),
 * optionally overriding {@link onEngineStart} for engine initialization.
 *
 * @see JournalDbMetrics
 * @see VrackDbMetrics
 * @see BootClass
 */
class BootDeviceMetrics extends BootClass_1.default {
    /**
     * Boot-class start hook (overrides {@link BootClass.onStart}).
     *
     * Runs the engine-specific initialization hook {@link onEngineStart} and
     * then wires the shared metric events, so every engine exposes the same
     * behavior with a single source of truth for the wiring.
     */
    onStart() {
        this.onEngineStart();
        this.Container.on('device.metric', this.deviceMetric.bind(this));
        this.Container.on('device.metric.register', this.deviceRegisterMetric.bind(this));
    }
    /**
     * Engine-specific initialization hook, called at the start of
     * {@link onStart} (before the events are wired).
     *
     * Use it to open the underlying store/database, etc. Default: no-op.
     *
     * @example
     * ```ts
     * protected onEngineStart(): void {
     *     this.DB = new Store(path.resolve(this.options.path, this.Container.id), { lock: 'off' })
     *     this.DB.init()
     * }
     * ```
     */
    onEngineStart() { }
    /**
     * `device.metric.register` event handler (shared).
     *
     * When a device is initialized the container passes the list of its
     * metrics; each one is registered through {@link registerMetric}.
     *
     * @param nEvent `{ device, data, trace: IMetricSettings }`
     */
    deviceRegisterMetric(nEvent) {
        this.registerMetric(this.getMetricPath(nEvent.device, nEvent.data), nEvent.trace);
    }
    /**
     * Returns the canonical metric path.
     *
     * @param device Device ID
     * @param name Metric name
     */
    getMetricPath(device, name) {
        return (device + '.' + name).toLowerCase();
    }
}
exports.default = BootDeviceMetrics;
