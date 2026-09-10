/**
 * Unit tests for ReactiveRef - a Vue-3-like reactive object wrapper.
 *
 * Behavior under test (see src/ReactiveRef.ts):
 *  - deep reactivity for nested plain objects
 *  - arrays are NOT tracked inside; only reassignment notifies
 *  - no notification when the value does not change
 */
import { describe, it, expect, vi } from 'vitest'
import { ReactiveRef } from 'vrack2-core'

describe('ReactiveRef', () => {
    it('exposes the value and notifies on nested property change', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ user: { name: 'Alice' } })
        state.watch(spy)

        expect(state.value.user.name).toBe('Alice')
        state.value.user.name = 'Bob'
        expect(spy).toHaveBeenCalledTimes(1)
        expect(state.value.user.name).toBe('Bob')
    })

    it('notifies when a new property is added', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ a: 1 })
        state.watch(spy)

        state.value.b = 2
        expect(spy).toHaveBeenCalledTimes(1)
        expect(state.value.b).toBe(2)
    })

    it('makes deeply nested objects reactive when assigned', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({})
        state.watch(spy)

        state.value.deep = { a: { b: 1 } }
        expect(spy).toHaveBeenCalledTimes(1) // assignment of a new property
        spy.mockClear()

        state.value.deep.a.b = 2
        expect(spy).toHaveBeenCalledTimes(1) // deep mutation is tracked
        expect(state.value.deep.a.b).toBe(2)
    })

    it('does not notify when setting the same value', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ n: 1 })
        state.watch(spy)

        state.value.n = 1
        expect(spy).not.toHaveBeenCalled()
    })

    it('does not track array mutations, but does track reassignment', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ items: [1, 2] })
        state.watch(spy)

        state.value.items.push(3)
        expect(spy).not.toHaveBeenCalled()
        expect(state.value.items).toEqual([1, 2, 3])

        state.value.items = [1, 2, 3, 4]
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('returns the same value reference (proxy over the object)', () => {
        const state = new ReactiveRef({ x: 1 })
        expect(state.value).toBe(state.value)
        state.value.x = 2
        expect(state.value.x).toBe(2)
    })

    it('set() replaces the value, keeps it reactive and notifies', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ a: 1 })
        state.watch(spy)

        state.set({ b: { c: 2 } })
        expect(spy).toHaveBeenCalledTimes(1)
        expect(state.value.a).toBeUndefined()
        expect(state.value.b.c).toBe(2)

        state.value.b.c = 3
        expect(spy).toHaveBeenCalledTimes(2) // новое значение тоже реактивное
    })

    it('set() with the same reference does not notify', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ a: 1 })
        state.watch(spy)
        state.set(state.value)
        expect(spy).not.toHaveBeenCalled()
    })

    it('unwatch() stops notifications', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ a: 1 })
        state.watch(spy)
        state.unwatch()

        state.value.a = 2
        expect(spy).not.toHaveBeenCalled()
        expect(state.value.a).toBe(2)
    })

    it('notifies on delete of an existing property only', () => {
        const spy = vi.fn()
        const state = new ReactiveRef({ a: 1 })
        state.watch(spy)

        delete state.value.a
        expect(spy).toHaveBeenCalledTimes(1)
        delete state.value.missing
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('keeps the __isReactive marker out of Object.keys / spread / JSON', () => {
        const state = new ReactiveRef({ a: 1, b: { c: 2 } })
        expect(Object.keys(state.value)).toEqual(['a', 'b'])
        expect({ ...state.value }).toEqual({ a: 1, b: { c: 2 } })
        expect(JSON.parse(JSON.stringify(state.value))).toEqual({ a: 1, b: { c: 2 } })
    })
})