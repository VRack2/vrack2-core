/**
 * Shared helpers for the integration tests that boot a real MainProcess
 * (Bootstrap -> boot classes -> Container -> devices/ports) using the `testkit`
 * fixture vendor. This module is NOT a test file (it does not match
 * `*.test.ts`), so Vitest never collects it directly.
 *
 * Each split test file calls `useTmpDir()` once at the top to register a fresh
 * tmp working directory per test (and the boot-fixture call-log reset), then
 * builds processes with `makeMP()` and asserts with `runOrError()` / `hasCode()`.
 * `makeMP()` always uses the current tmp dir set by the hook, so most tests
 * never touch `tmp` directly — only the ones that inspect on-disk artifacts do.
 */
import { beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import {
    MainProcess,
    IMainProcessOptions,
    IServiceStructure,
} from 'vrack2-core'
import * as testkit from 'testkit'

export const FIXTURES = path.resolve(__dirname, '../fixtures')

export const EMPTY_SERVICE: IServiceStructure = { devices: [], connections: [] }

/** The current per-test tmp dir; updated by the beforeEach hook registered below. */
let currentTmp = ''

/**
 * Register the per-test tmp working directory (fresh mkdtemp per test, removed
 * after) and reset the call-logs of the boot-class fixtures. Returns a getter
 * for the current tmp dir — call it inside a test to build paths under it.
 */
export function useTmpDir(): () => string {
    beforeEach(() => {
        currentTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-int-'))
        ;(testkit.GoodBoot as any).calls = []
        ;(testkit.TermBoot as any).destroyed = []
    })
    afterEach(() => {
        if (currentTmp && fs.existsSync(currentTmp)) fs.rmSync(currentTmp, { recursive: true, force: true })
    })
    return () => currentTmp
}

/** Build a MainProcess with the standard boot class set (paths under the current tmp dir). */
export function makeMP(service: IServiceStructure, extraBoot: IMainProcessOptions['bootstrap'] = {}, confFile?: string): MainProcess {
    return new MainProcess({
        id: 'itest',
        service,
        confFile,
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: FIXTURES, dir: 'devices' } },
            DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: { storageDir: path.join(currentTmp, 'storage') } },
            StructureStorage: { path: 'vrack2-core.StructureStorage', options: { structureDir: path.join(currentTmp, 'structure') } },
            DeviceMetrics: { path: 'vrack2-core.JournalDbMetrics', options: { path: path.join(currentTmp, 'journals') } },
            ServiceLogger: { path: 'vrack2-core.ServiceLogger', options: { path: path.join(currentTmp, 'logs') } },
            PortLogger: { path: 'vrack2-core.PortLogger', options: { path: path.join(currentTmp, 'logs') } },
            ...extraBoot,
        },
    })
}

/** Run the process and return the thrown error (or undefined). */
export async function runOrError(mp: MainProcess): Promise<any> {
    try {
        await mp.run()
        return undefined
    } catch (e) {
        return e
    }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Check that err (and its nested errors) contain the given vShort code. */
export function hasCode(err: any, code: string): boolean {
    if (!err) return false
    if (err.vShort === code) return true
    if (Array.isArray(err.vAddErrors)) return err.vAddErrors.some((e: any) => hasCode(e, code))
    return false
}
