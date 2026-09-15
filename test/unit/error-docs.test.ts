/**
 * Error codes documentation sync.
 *
 * AGENTS.md rule #3: error codes are documented ONLY in docs/08-Errors.md.
 * This test enforces that mechanically (in both directions):
 *
 *  - every code registered in src/ (via `ErrorManager.register(...)`)
 *    must be present in docs/08-Errors.md;
 *  - every documented error code (a backticked `ALL_CAPS_WITH_UNDERSCORE`
 *    token) must be registered in src/.
 *
 * The check is source-scanning (no new public API): all `register()` calls
 * keep the `short` code as the second argument on the first line of the call.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

/** Recursively collect all .ts files under a directory */
function listTsFiles(dir: string): Array<string> {
    const out: Array<string> = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...listTsFiles(fp))
        else if (fp.endsWith('.ts')) out.push(fp)
    }
    return out
}

/** All error `short` codes registered in the framework source */
function registeredCodes(): Array<string> {
    const codes = new Set<string>()
    for (const fp of listTsFiles(path.join(ROOT, 'src'))) {
        const src = fs.readFileSync(fp, 'utf-8')
        for (const m of src.matchAll(/ErrorManager\.register\(\s*'[^']+',\s*'([A-Z0-9_]+)'/g)) {
            codes.add(m[1])
        }
    }
    return [...codes].sort()
}

/** All backticked ALL_CAPS_WITH_UNDERSCORE tokens in the docs (error codes) */
function documentedCodes(): Array<string> {
    const doc = fs.readFileSync(path.join(ROOT, 'docs/08-Errors.md'), 'utf-8')
    return [...new Set([...doc.matchAll(/`([A-Z][A-Z0-9]*(_[A-Z0-9]+)+)`/g)].map((m) => m[1]))].sort()
}

describe('error codes: src/ <-> docs/08-Errors.md sync', () => {

    it('finds registered error codes in src/', () => {
        // Sanity guard: the scan itself must work (the framework has 50+ codes)
        expect(registeredCodes().length).toBeGreaterThanOrEqual(50)
    })

    it('every code registered in src/ is documented in docs/08-Errors.md', () => {
        const codes = registeredCodes()
        const doc = fs.readFileSync(path.join(ROOT, 'docs/08-Errors.md'), 'utf-8')
        const missing = codes.filter((code) => !doc.includes('`' + code + '`'))
        expect(missing).toEqual([])
    })

    it('every documented error code is registered in src/', () => {
        const codes = registeredCodes()
        const undocumented = documentedCodes().filter((code) => !codes.includes(code))
        expect(undocumented).toEqual([])
    })
})