/**
 * Unit tests for `mergeBootList` — the layered boot-list merge.
 *
 * Semantics (per-id, higher layer wins):
 *  - entry with `path` — adds or fully replaces;
 *  - entry without `path` — shallow-merges options over a lower-layer entry
 *    (must match an existing id, else BS_BAD_BOOTLIST);
 *  - `null` — removes the id;
 *  - first insertion order preserved;
 *  - nullish layers are skipped;
 *  - input layers are not mutated.
 */
import { describe, it, expect } from 'vitest'
import { mergeBootList, ErrorManager, CoreError, type IBootListConfig } from 'vrack2-core'

describe('mergeBootList', () => {

    it('a single layer is returned as a fresh copy (no shared references)', () => {
        const a: IBootListConfig = { X: { path: 'a', options: { v: 1 } } }
        const out = mergeBootList([a])
        expect(out).toEqual({ X: { path: 'a', options: { v: 1 } } })
        out.X!.options.v = 99
        expect(a.X!.options.v).toBe(1)
        out.X!.path = 'zzz'
        expect(a.X!.path).toBe('a')
    })

    it('nullish layers are skipped', () => {
        const a: IBootListConfig = { A: { path: 'p.a', options: { x: 1 } } }
        expect(mergeBootList([a, null, undefined])).toEqual({ A: { path: 'p.a', options: { x: 1 } } })
        expect(mergeBootList([null, undefined])).toEqual({})
    })

    it('entry with path replaces a lower-layer entry (path and options), preserving insertion order', () => {
        const low: IBootListConfig = {
            A: { path: 'low.a', options: { x: 1, y: 2 } },
            B: { path: 'low.b', options: {} },
        }
        const high: IBootListConfig = {
            A: { path: 'high.a', options: { z: 3 } },
        }
        const out = mergeBootList([low, high])
        expect(out.A).toEqual({ path: 'high.a', options: { z: 3 } })
        expect(out.B).toEqual({ path: 'low.b', options: {} })
        expect(Object.keys(out)).toEqual(['A', 'B'])
    })

    it('entry without path shallow-merges options over a lower-layer entry (higher wins)', () => {
        const low: IBootListConfig = {
            A: { path: 'low.a', options: { x: 1, y: 2, k: 'keep' } },
        }
        const high: IBootListConfig = {
            A: { options: { y: 20, z: 3 } } as IBootListConfig['A'],
        }
        const out = mergeBootList([low, high])
        expect(out.A).toEqual({ path: 'low.a', options: { x: 1, y: 20, z: 3, k: 'keep' } })
    })

    it('entry without path that matches no lower layer throws BS_BAD_BOOTLIST', () => {
        const low: IBootListConfig = { A: { path: 'low.a', options: {} } }
        const high: IBootListConfig = { ORPHAN: { options: { v: 1 } } as IBootListConfig['ORPHAN'] }
        expect(() => mergeBootList([low, high])).toThrowError(CoreError)
        try {
            mergeBootList([low, high])
            expect.unreachable('should have thrown')
        } catch (e: any) {
            expect(ErrorManager.isCode(e, 'BS_BAD_BOOTLIST')).toBe(true)
        }
    })

    it('entry with null (missing options) in a layer throws BS_BAD_BOOTLIST', () => {
        const low: IBootListConfig = { A: { path: 'low.a', options: {} } }
        const high: IBootListConfig = { A: { options: null as any } }
        expect(() => mergeBootList([low, high])).toThrowError(CoreError)
    })

    it('null value removes the id even if a lower layer had it', () => {
        const low: IBootListConfig = {
            A: { path: 'low.a', options: { x: 1 } },
            B: { path: 'low.b', options: {} },
        }
        const mid: IBootListConfig = { A: null }
        const out = mergeBootList([low, mid])
        expect(out).toEqual({ B: { path: 'low.b', options: {} } })
    })

    it('layer priority: higher-layer option wins over lower-layer option for the same id', () => {
        const l1: IBootListConfig = { M: { path: 'm', options: { v: 1 } } }
        const l2: IBootListConfig = { M: { options: { v: 2 } } as IBootListConfig['M'] }
        const l3: IBootListConfig = { M: { options: { v: 3 } } as IBootListConfig['M'] }
        const out = mergeBootList([l1, l2, l3])
        expect(out.M!.options.v).toBe(3)
    })

    it('layer priority: a later null in the top layer removes despite lower layers', () => {
        const l1: IBootListConfig = { M: { path: 'm', options: { v: 1 } } }
        const l2: IBootListConfig = { M: null }
        const l3: IBootListConfig = { M: { path: 'm3', options: { v: 3 } } }
        const out = mergeBootList([l1, l2, l3])
        expect(out.M).toEqual({ path: 'm3', options: { v: 3 } })
    })

    it('first insertion order of an id is preserved across layers', () => {
        const low: IBootListConfig = { A: { path: 'a', options: {} }, B: { path: 'b', options: {} } }
        const high: IBootListConfig = { B: { path: 'b2', options: {} }, C: { path: 'c', options: {} } }
        const out = mergeBootList([low, high])
        expect(Object.keys(out)).toEqual(['A', 'B', 'C'])
        expect(out.B!.path).toBe('b2')
    })

    it('input layers are not mutated by the merge', () => {
        const low: IBootListConfig = { A: { path: 'low', options: { x: 1 } } }
        const high: IBootListConfig = { A: { options: { y: 2 } } as IBootListConfig['A'], N: null }
        const lowSnapshot = JSON.stringify(low)
        const highSnapshot = JSON.stringify(high)
        mergeBootList([low, high])
        expect(JSON.stringify(low)).toBe(lowSnapshot)
        expect(JSON.stringify(high)).toBe(highSnapshot)
    })

    it('new id with path in a higher layer is appended', () => {
        const low: IBootListConfig = { A: { path: 'a', options: {} } }
        const high: IBootListConfig = { NEW: { path: 'n', options: { v: 9 } } }
        const out = mergeBootList([low, high])
        expect(out.NEW).toEqual({ path: 'n', options: { v: 9 } })
        expect(Object.keys(out)).toEqual(['A', 'NEW'])
    })
})