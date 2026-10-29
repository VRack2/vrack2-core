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
const ErrorManager_1 = __importDefault(require("../../errors/ErrorManager"));
const Rule_1 = __importDefault(require("../../validator/Rule"));
/**
 * Common base class for the device-metrics boot-class engines —
 * `JournalDbMetrics` (disk-backed, `vrack2-journal-db`) and
 * `VrackDbMetrics` (in-memory, `vrack-db`, backward compatibility).
 *
 * It defines the contract every metrics engine exposes to the service:
 * `has()` and `read()` for reading, and the `device.metric` /
 * `device.metric.register` event wiring for writing. It also keeps the
 * declaration registry: exact declarations and wildcard group patterns
 * (`'group.*'`), with the known members of each group expanded into exact
 * paths, plus the set of metric paths actually seen in writes.
 *
 * A device may write any metric name — declarations are metadata, not
 * permission. A write matching no declaration is stored as-is (unknown
 * metric), with no description.
 *
 * Subclasses extend this instead of {@link BootClass} directly and implement
 * the abstract engine hooks (`has`, `read`, `deviceMetric`), optionally
 * overriding {@link onEngineStart} for engine initialization and
 * {@link registerMetric} for declaration side effects (e.g. pre-creating
 * in-memory series).
 *
 * @see JournalDbMetrics
 * @see VrackDbMetrics
 * @see BootClass
 */
class BootDeviceMetrics extends BootClass_1.default {
    constructor() {
        super(...arguments);
        /**
         * Metric declarations by path (device.name, lowercased). Wildcard group
         * patterns are stored under their pattern path (contains `*`).
         */
        this.declared = new Map();
        /**
         * Metric paths written at least once since the engine started.
         */
        this.seen = new Set();
    }
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
     * Declaration hook — called for every registered declaration path.
     *
     * Called by {@link deviceRegisterMetric} once per exact path and once per
     * group pattern (with the path containing `*`). Engines that need a
     * storage object per metric (e.g. an in-memory series) create it here —
     * pattern registrations are a no-op for them. Default: no-op (the
     * journal-db engine stores every metric in one table).
     *
     * @param path Metric path (device.name, lowercased) or group pattern path
     * @param metric Metric settings
     * @see IMetricSettings
     */
    registerMetric(path, metric) { }
    /**
     * `device.metric.register` event handler (shared).
     *
     * When a device is initialized the container passes its metric
     * declarations; the base records them (expanding known group members
     * into exact paths) and calls {@link registerMetric} per path.
     *
     * @param nEvent `{ device, data: declared key, trace: IMetricSettings }`
     */
    deviceRegisterMetric(nEvent) {
        const key = String(nEvent.data);
        // The container passes the same object it stores in the live
        // structure — the engine keeps its own copy so structure consumers
        // cannot mutate the declaration registry (opaque `additional` stays
        // by reference).
        const settings = this.cloneSettings(nEvent.trace);
        this.checkGroupPattern(key, settings);
        this.declared.set(this.getMetricPath(nEvent.device, key), settings);
        this.registerMetric(this.getMetricPath(nEvent.device, key), settings);
        if (settings.kind === 'group' && settings.list) {
            for (const member in settings.list) {
                if (member.includes('*')) {
                    throw ErrorManager_1.default.make('BDM_GROUP_PATTERN', { key, member });
                }
                const memberPath = this.getMetricPath(nEvent.device, key.replace('*', member));
                this.declared.set(memberPath, settings.list[member]);
                this.registerMetric(memberPath, settings.list[member]);
            }
        }
    }
    /**
     * Validates a declaration key: a wildcard key must contain **exactly
     * one** `*` (a group). Keys with multiple `*` would expand members to
     * dead pattern-containing paths (silently unreachable by `has()`), so
     * they are rejected at registration (fail-closed).
     *
      * @throws `BDM_GROUP_PATTERN` for a malformed wildcard key
     */
    checkGroupPattern(key, settings) {
        if (!key.includes('*'))
            return;
        if (settings.kind !== 'group' || key.split('*').length - 1 !== 1) {
            throw ErrorManager_1.default.make('BDM_GROUP_PATTERN', { key });
        }
    }
    /**
     * Shallow-copies a declaration (and its member map) so the engine's
     * registry is decoupled from the container structure.
     */
    cloneSettings(s) {
        const copy = { ...s };
        if (s.list) {
            const list = {};
            for (const name in s.list)
                list[name] = { ...s.list[name] };
            copy.list = list;
        }
        return copy;
    }
    /**
     * Marks a metric path as written (call from the engine's write path).
     *
     * @param path Metric path (device.name, lowercased)
     */
    markSeen(path) {
        this.seen.add(path);
    }
    /**
     * Checks whether a metric path is known: declared exactly (no `*`) or
     * written at least once.
     *
     * @param path Metric path (device.name, lowercased)
     */
    isKnown(path) {
        if (this.seen.has(path))
            return true;
        const d = this.declared.get(path);
        return d !== undefined && !path.includes('*');
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
ErrorManager_1.default.registerMany('BootDeviceMetrics', [
    {
        short: 'BDM_GROUP_PATTERN',
        description: 'Malformed metric group declaration key: a wildcard key must contain exactly one `*`, and a `list()` member name must not contain `*` (multi-wildcard keys expand members to unreachable paths)',
        rules: {
            key: Rule_1.default.string().required().description('Declaration key from Device.metrics()'),
            member: Rule_1.default.string().description('Offending member name (when the member contains `*`)'),
        }
    },
]);
