"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BootDatabaseSqlite_1 = __importDefault(require("./BootDatabaseSqlite"));
const Rule_1 = __importDefault(require("../validator/Rule"));
/**
 * In-memory SQLite adapter: {@link BootDatabaseSqlite} with the `file`
 * option defaulting to `:memory:`, so a database instance with no options
 * is a pure in-memory database (no disk file, data lives as long as the
 * process). It still accepts an explicit `file` path — such an instance then
 * behaves exactly as `BootDatabaseSqlite` (a regular file database).
 *
 * Use it where a throwaway database is wanted (tests, scratch data); use
 * {@link BootDatabaseSqlite} for data that must survive the process.
 *
 * @extends BootDatabaseSqlite
 */
class BootDatabaseMemory extends BootDatabaseSqlite_1.default {
    /**
     * Options: the `file` option of {@link BootDatabaseSqlite} with the
     * default changed to `:memory:`; `wal`/`readOnly` are inherited
     * (both are no-ops for an in-memory database).
     */
    checkOptions() {
        return {
            file: Rule_1.default.string().required().default(':memory:').description('Path to the database file; defaults to ":memory:" — a pure in-memory database'),
            wal: Rule_1.default.boolean().required().default(true).description('Inherited, no effect on ":memory:"'),
            readOnly: Rule_1.default.boolean().required().default(false).description('Inherited, no effect on ":memory:"')
        };
    }
}
exports.default = BootDatabaseMemory;
