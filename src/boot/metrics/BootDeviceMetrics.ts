/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import BootClass from '../BootClass';
import IDeviceEvent from '../../service/IDeviceEvent';
import IMetricSettings from '../../metrics/IMetricSettings';

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
export default abstract class BootDeviceMetrics extends BootClass {

    /**
     * Boot-class start hook (overrides {@link BootClass.onStart}).
     *
     * Runs the engine-specific initialization hook {@link onEngineStart} and
     * then wires the shared metric events, so every engine exposes the same
     * behavior with a single source of truth for the wiring.
     */
    onStart(): void {
        this.onEngineStart()
        this.Container.on('device.metric', this.deviceMetric.bind(this))
        this.Container.on('device.metric.register', this.deviceRegisterMetric.bind(this))
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
    protected onEngineStart(): void { }

    /**
     * Checks if the metric exists.
     *
     * @param device Device ID
     * @param name Registered metric name
     */
    abstract has(device: string, name: string): boolean

    /**
     * Reads the device metric series for a period.
     *
     * The concrete result shape is engine-specific — see the subclass docs.
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @param precision Bucket size (an interval string) or a point count
     * @param func Per-bucket aggregation function
     */
    abstract read(device: string, name: string, period: string, precision: string | number, func?: string): unknown

    /**
     * Registers the device metric in the engine's storage.
     *
     * @param path Metric path (device.name, lowercased)
     * @param metric Metric settings
     * @see IMetricSettings
     */
    protected abstract registerMetric(path: string, metric: IMetricSettings): void

    /**
     * Writes a metric value to the engine's storage.
     *
     * @param nEvent `{ device, data, trace: { value } }`
     */
    protected abstract deviceMetric(nEvent: IDeviceEvent): void

    /**
     * `device.metric.register` event handler (shared).
     *
     * When a device is initialized the container passes the list of its
     * metrics; each one is registered through {@link registerMetric}.
     *
     * @param nEvent `{ device, data, trace: IMetricSettings }`
     */
    protected deviceRegisterMetric(nEvent: IDeviceEvent) {
        this.registerMetric(this.getMetricPath(nEvent.device, nEvent.data), nEvent.trace)
    }

    /**
     * Returns the canonical metric path.
     *
     * @param device Device ID
     * @param name Metric name
     */
    protected getMetricPath(device: string, name: string) {
        return (device + '.' + name).toLowerCase()
    }
}
