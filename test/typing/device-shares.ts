/**
 * Type-level regression test for typed `Device.shares`.
 *
 * This file is NOT executed by vitest — it only has to compile under the repo's
 * strict settings. Run with: `npm run typecheck:types`
 * (tsc --noEmit -p tsconfig.typetest.json, which maps `vrack2-core` to src/).
 *
 * It pins the supported typing patterns for `Device` instance data:
 *  - a subclass declares `shares = {...}` as its own field — the canonical pattern:
 *    `this.shares` keeps its declared type inside and outside the class,
 *    unknown keys / wrong value types are compile errors (@ts-expect-error)
 *  - interface-based shapes work too (assignability into plain-Device collections)
 *  - a subclass without a typed field keeps the base Record<string, any> model
 *  - `options` can be narrowed per class with a type-only `declare options: ...`
 */
import { Container, Device } from 'vrack2-core'

type MyShares = { data: number; name: string; nested: { on: boolean } }

export class TypedDevice extends Device {
    constructor(id: string, cc: Container) { super(id, 'testkit.Typed', cc) }

    shares: MyShares = { data: 1, name: 'x', nested: { on: false } }

    work(): number {
        this.shares.data = 42 // ok: number
        this.shares.name = 'hi' // ok: string
        this.shares.nested.on = true // ok: boolean
        const n: number = this.shares.data // per-class typing inside the class body

        // @ts-expect-error — a string is not assignable to `data: number`
        this.shares.data = 'oops'
        // @ts-expect-error — unknown keys must be rejected by the declared type
        this.shares.whatever = 1

        return n
    }
}

// interface-based shape (no implicit index signature) — must work as well
interface IShares { count: number; label: string }

export class IntfDevice extends Device {
    constructor(id: string, cc: Container) { super(id, 'testkit.Intf', cc) }

    shares: IShares = { count: 0, label: '' }
}

// The per-class typing stays visible from outside the class as well (not `any`)
const typed = new TypedDevice('T1', {} as Container)
export const n: number = typed.shares.data

// @ts-expect-error — unknown keys must be rejected by the declared type
typed.shares.whatever = 1

// Heterogeneous registration into plain-`Device` container APIs still compiles (variance BC)
const cc = {} as Container
cc.registerDevice(new TypedDevice('T2', cc))
cc.registerDevice(new IntfDevice('I1', cc))
export const dev: Device | undefined = cc.getDevice('T2')

// A subclass without a typed field keeps the base Record<string, any> model (free-form)
export class FreeForm extends Device {
    constructor(id: string, cc: Container) { super(id, 'testkit.Free', cc) }
}
const free = new FreeForm('F1', cc)
free.shares.anything = 42 // ok: Record<string, any>

// Per-class typing of `options`: a type-only narrowing in the subclass (no runtime effect)
type MyOptions = { limit: number; mode: 'fast' | 'slow' }

export class OptionsTyped extends Device {
    constructor(id: string, cc: Container) { super(id, 'testkit.Options', cc) }

    declare options: MyOptions

    work(): number { return this.options.limit } // typed inside the class
}
const opt = new OptionsTyped('O1', cc)
export const limit: number = opt.options.limit
