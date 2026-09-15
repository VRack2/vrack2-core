/**
 * Unit tests for the validator: Rule, Validator and all rule types.
 *
 * Includes regression tests for previously found bugs:
 *  - Validator.makeMessage: template placeholders ({value} {description} ...)
 *    were never replaced (String.replace results were discarded)
 *  - StringType checkMaxLength/checkMinLength: off-by-one, a string with
 *    length exactly equal to max/min used to fail
 *  - ArrayType: content() rules were silently never applied
 *    (switch matched 'fields' but the rule was stored as 'contain')
 */
import { describe, it, expect } from 'vitest'
import { Rule, Validator, ErrorManager, SubruleNames, type SubruleName } from 'vrack2-core'

/**
 * Runs validation and returns the thrown error.
 * Fails the test if validation unexpectedly passed.
 */
function validateError(rules: { [key: string]: any }, data: { [key: string]: any }): any {
    try {
        Validator.validate(rules, data)
    } catch (e) {
        return e
    }
    throw new Error('Validation was expected to fail, but it passed')
}

/** Finds a validation problem by field key inside the VR_NOT_PASS error */
function problemOf(err: any, key: string): any {
    expect(err.vShort).toBe('VR_NOT_PASS')
    const p = err.problems.find((x: any) => x.fieldKey === key)
    expect(p).toBeDefined()
    return p
}

describe('Rule + Validator: strings', () => {
    it('accepts a valid string', () => {
        expect(Validator.validate({ s: Rule.string() }, { s: 'hello' })).toBe(true)
    })

    it('rejects a non-string value (VR_IS_NOT_STRING)', () => {
        const err = validateError({ s: Rule.string() }, { s: 42 })
        const p = problemOf(err, 's')
        expect(p.type).toBe('VR_IS_NOT_STRING')
    })

    it('applies default value when the key is missing', () => {
        const data: any = {}
        Validator.validate({ s: Rule.string().default('fallback') }, data)
        expect(data.s).toBe('fallback')
    })

    it('throws VR_ERROR_REQUIRED for a missing required value', () => {
        const err = validateError({ s: Rule.string().required() }, {})
        const p = problemOf(err, 's')
        expect(p.type).toBe('VR_ERROR_REQUIRED')
    })

    it('deprecated require() alias works like required()', () => {
        const err = validateError({ s: Rule.string().require() }, {})
        expect(problemOf(err, 's').type).toBe('VR_ERROR_REQUIRED')
    })

    it('maxLength: length exactly equal to max passes, above fails', () => {
        expect(Validator.validate({ s: Rule.string().maxLength(5) }, { s: 'abcde' })).toBe(true)
        const err = validateError({ s: Rule.string().maxLength(5) }, { s: 'abcdef' })
        expect(problemOf(err, 's').type).toBe('VR_STRING_MAX_LENGTH')
    })

    it('minLength: length exactly equal to min passes, below fails', () => {
        expect(Validator.validate({ s: Rule.string().minLength(2) }, { s: 'ab' })).toBe(true)
        const err = validateError({ s: Rule.string().minLength(2) }, { s: 'a' })
        expect(problemOf(err, 's').type).toBe('VR_STRING_MIN_LENGTH')
    })
})

describe('Rule + Validator: numbers', () => {
    it('accepts a valid number', () => {
        expect(Validator.validate({ n: Rule.number() }, { n: 3.14 })).toBe(true)
    })

    it('rejects a non-number value (VR_IS_NOT_NUMBER)', () => {
        const err = validateError({ n: Rule.number() }, { n: 'x' })
        expect(problemOf(err, 'n').type).toBe('VR_IS_NOT_NUMBER')
    })

    it('integer: accepts integers, rejects fractions (VR_NUMBER_INTEGER)', () => {
        expect(Validator.validate({ n: Rule.number().integer() }, { n: 5 })).toBe(true)
        const err = validateError({ n: Rule.number().integer() }, { n: 5.5 })
        expect(problemOf(err, 'n').type).toBe('VR_NUMBER_INTEGER')
    })

    it('min: boundary passes, below fails (VR_NUMBER_MIN)', () => {
        expect(Validator.validate({ n: Rule.number().min(5) }, { n: 5 })).toBe(true)
        const err = validateError({ n: Rule.number().min(5) }, { n: 4.999 })
        expect(problemOf(err, 'n').type).toBe('VR_NUMBER_MIN')
    })

    it('max: boundary passes, above fails (VR_NUMBER_MAX)', () => {
        expect(Validator.validate({ n: Rule.number().max(10) }, { n: 10 })).toBe(true)
        const err = validateError({ n: Rule.number().max(10) }, { n: 10.001 })
        expect(problemOf(err, 'n').type).toBe('VR_NUMBER_MAX')
    })

    it('applies default value when the key is missing', () => {
        const data: any = {}
        Validator.validate({ n: Rule.number().default(42) }, data)
        expect(data.n).toBe(42)
    })
})

describe('Rule + Validator: booleans, functions, arrays, objects', () => {
    it('boolean: accepts booleans, rejects others (VR_IS_NOT_BOOLEAN)', () => {
        expect(Validator.validate({ b: Rule.boolean() }, { b: false })).toBe(true)
        const err = validateError({ b: Rule.boolean() }, { b: 'false' })
        expect(problemOf(err, 'b').type).toBe('VR_IS_NOT_BOOLEAN')
    })

    it('boolean default is applied', () => {
        const data: any = {}
        Validator.validate({ b: Rule.boolean().default(true) }, data)
        expect(data.b).toBe(true)
    })

    it('function: accepts functions, rejects others (VR_IS_NOT_FUNCTION)', () => {
        expect(Validator.validate({ f: Rule.function() }, { f: () => 1 })).toBe(true)
        const err = validateError({ f: Rule.function() }, { f: 1 })
        expect(problemOf(err, 'f').type).toBe('VR_IS_NOT_FUNCTION')
    })

    it('array: accepts arrays, rejects others (VR_IS_NOT_ARRAY)', () => {
        expect(Validator.validate({ a: Rule.array() }, { a: [1, 2, 3] })).toBe(true)
        const err = validateError({ a: Rule.array() }, { a: 'nope' })
        expect(problemOf(err, 'a').type).toBe('VR_IS_NOT_ARRAY')
    })

    it('array content(): validates each element against the content rule', () => {
        const rules = { a: Rule.array().required().content(Rule.string()) }
        expect(Validator.validate(rules, { a: ['x', 'y'] })).toBe(true)

        const err = validateError(rules, { a: ['x', 42] })
        const p = problemOf(err, 'a')
        expect(p.type).toBe('VR_ARRAY_CONTENT_ERROR')
        // the failing element index is reported
        expect(p.arg.index).toBe(1)
    })

    it('object: accepts objects, rejects others (VR_IS_NOT_OBJECT)', () => {
        expect(Validator.validate({ o: Rule.object() }, { o: { a: 1 } })).toBe(true)
        const err = validateError({ o: Rule.object() }, { o: 5 })
        expect(problemOf(err, 'o').type).toBe('VR_IS_NOT_OBJECT')
    })

    it('object fields(): validates nested rules (VR_ERROR_OBJECT_FIELDS)', () => {
        const rules = {
            o: Rule.object().fields({
                b: Rule.boolean().required().description('Boolean checkbox'),
            }),
        }
        expect(Validator.validate(rules, { o: { b: true } })).toBe(true)

        const err = validateError(rules, { o: { b: 'not-a-bool' } })
        const p = problemOf(err, 'o')
        expect(p.type).toBe('VR_ERROR_OBJECT_FIELDS')
    })
})

describe('Rule + Validator: messages and export', () => {
    it('uses the custom message template with substituted placeholders', () => {
        const rules = {
            name: Rule.string()
                .description('Name')
                .message('The {description} must be a string, not {value}'),
        }
        const err = validateError(rules, { name: 42 })
        const p = problemOf(err, 'name')
        expect(p.description).toBe('The Name must be a string, not 42')
    })

    it('keeps the default message when no template is set', () => {
        const err = validateError({ n: Rule.number() }, { n: 'x' })
        const p = problemOf(err, 'n')
        expect(p.description).toBe('Value must be a number')
    })

    it('report structure: type, code, fieldKey, description, rule, arg', () => {
        const err = validateError({ n: Rule.number().min(5) }, { n: 1 })
        const p = problemOf(err, 'n')
        expect(p.type).toBe('VR_NUMBER_MIN')
        expect((p as any).code).toBeUndefined()
        expect(p.fieldKey).toBe('n')
        expect(p.description).toBeTypeOf('string')
        expect(p.rule).toEqual(expect.objectContaining({ type: 'number' }))
        expect(p.arg).toEqual(expect.objectContaining({ limit: 5 }))
    })

    it('export() returns a plain JSON-serializable rule object', () => {
        const exported = Rule.string().description('D').export()
        expect(exported).toEqual({
            type: 'string',
            require: false,
            default: undefined,
            rules: [],
            example: undefined,
            description: 'D',
            message: '',
        })
    })

    it('multiple problems are collected in one VR_NOT_PASS error', () => {
        const rules = {
            s: Rule.string(),
            n: Rule.number(),
            b: Rule.boolean(),
        }
        const err = validateError(rules, { s: 1, n: 'x', b: 0 })
        expect(err.vShort).toBe('VR_NOT_PASS')
        expect(err.problems).toHaveLength(3)
        const types = err.problems.map((p: any) => p.type).sort()
        expect(types).toEqual([
            'VR_IS_NOT_BOOLEAN',
            'VR_IS_NOT_NUMBER',
            'VR_IS_NOT_STRING',
        ])
    })

    it('ErrorManager.isCode() recognizes VR_NOT_PASS', () => {
        const err = validateError({ s: Rule.string() }, { s: 1 })
        expect(ErrorManager.isCode(err, 'VR_NOT_PASS')).toBe(true)
    })
})

describe('Validator: fail-closed guarantees (regression)', () => {
    it('wraps non-CoreError rule failures into VR_NOT_PASS (no silent pass)', () => {
        const err = validateError({ s: { type: 'string' } as any }, { s: 42 })
        const p = problemOf(err, 's')
        expect(p.type).toBe('VR_VALIDATION_INTERNAL')
        expect(p.arg).toEqual(expect.objectContaining({ key: 's' }))
        expect(String(p.arg.original)).toContain('TypeError')
    })

    it('throws a CoreError when the rules table is not an object', () => {
        let caught: any = undefined
        try {
            Validator.validate(null as any, {})
        } catch (e) {
            caught = e
        }
        expect(caught).toBeDefined()
        expect(ErrorManager.isCode(caught, 'VR_VALIDATION_INTERNAL')).toBe(true)
    })

    it('rejects a null data object (no silent pass)', () => {
        const err = validateError({ s: Rule.string() }, null as any)
        const p = problemOf(err, 's')
        expect(p.type).toBe('VR_VALIDATION_INTERNAL')
    })

    it('rejects null for Rule.object() (VR_IS_NOT_OBJECT)', () => {
        const err = validateError({ o: Rule.object() }, { o: null })
        expect(problemOf(err, 'o').type).toBe('VR_IS_NOT_OBJECT')
    })

    it('rejects null for Rule.object().fields() (required fields are not bypassed)', () => {
        const rules = {
            o: Rule.object().fields({ b: Rule.boolean().required() }),
        }
        const err = validateError(rules, { o: null })
        expect(problemOf(err, 'o').type).toBe('VR_IS_NOT_OBJECT')
    })

    it('rejects NaN for Rule.number() (VR_IS_NOT_NUMBER)', () => {
        const err = validateError({ n: Rule.number() }, { n: NaN })
        expect(problemOf(err, 'n').type).toBe('VR_IS_NOT_NUMBER')
    })

    it('rejects NaN even when min/max constraints are set', () => {
        const err = validateError({ n: Rule.number().min(5).max(10) }, { n: NaN })
        expect(problemOf(err, 'n').type).toBe('VR_IS_NOT_NUMBER')
    })

    it('rejects +Infinity and -Infinity for Rule.number()', () => {
        const up = validateError({ n: Rule.number() }, { n: Infinity })
        expect(problemOf(up, 'n').type).toBe('VR_IS_NOT_NUMBER')
        const down = validateError({ n: Rule.number() }, { n: -Infinity })
        expect(problemOf(down, 'n').type).toBe('VR_IS_NOT_NUMBER')
    })

    it('keeps finite numbers working (min/max still enforced)', () => {
        expect(Validator.validate({ n: Rule.number().min(1).max(10) }, { n: 5 })).toBe(true)
    })

    it('injects an isolated copy of a mutable default (no shared reference)', () => {
        const rules = {
            list: Rule.array().default(['x']),
            nested: Rule.object().default({ v: 1 }),
        }
        const d1: any = {}
        const d2: any = {}
        Validator.validate(rules, d1)
        Validator.validate(rules, d2)
        d1.list.push('mutated')
        d1.nested.v = 42
        expect(d1.list).not.toBe(d2.list)
        expect(d1.nested).not.toBe(d2.nested)
        expect(d2.list).toEqual(['x'])
        expect(d2.nested).toEqual({ v: 1 })
    })
})

describe('Rule + Validator: require semantics (regression)', () => {
    it('an optional (not required) field passes when the key is missing', () => {
        const data: any = {}
        expect(Validator.validate({ s: Rule.string() }, data)).toBe(true)
        expect(data).toEqual({})
    })

    it('a required field fails with VR_ERROR_REQUIRED when missing', () => {
        const err = validateError({ s: Rule.string().required() }, {})
        expect(problemOf(err, 's').type).toBe('VR_ERROR_REQUIRED')
    })

    it('a present value of an optional field is still type-checked', () => {
        const err = validateError({ s: Rule.string() }, { s: 42 })
        expect(problemOf(err, 's').type).toBe('VR_IS_NOT_STRING')
    })

    it('an explicit null of an optional field is present and rejected', () => {
        const err = validateError({ s: Rule.string() }, { s: null })
        expect(problemOf(err, 's').type).toBe('VR_IS_NOT_STRING')
    })

    it('a default satisfies a required rule when the key is missing', () => {
        const data: any = {}
        expect(Validator.validate({ n: Rule.number().required().default(7) }, data)).toBe(true)
        expect(data.n).toBe(7)
    })

    it('an optional number field passes when missing (min/max are not run)', () => {
        expect(Validator.validate({ n: Rule.number().min(1).max(10) }, {})).toBe(true)
    })

    it('an optional object field passes when missing (subfields are not validated)', () => {
        const rules = {
            o: Rule.object().fields({ b: Rule.boolean().required() }),
        }
        expect(Validator.validate(rules, {})).toBe(true)
    })

    it('a present optional object is still validated with its required subfields', () => {
        const rules = {
            o: Rule.object().fields({ b: Rule.boolean().required() }),
        }
        const err = validateError(rules, { o: {} })
        expect(problemOf(err, 'o').type).toBe('VR_ERROR_OBJECT_FIELDS')
    })

    it('an optional array field passes when missing (content is not validated)', () => {
        const rules = { a: Rule.array().content(Rule.string().required()) }
        expect(Validator.validate(rules, {})).toBe(true)
    })

    it('Rule.any() accepts a missing value', () => {
        expect(Validator.validate({ x: Rule.any() }, {})).toBe(true)
    })
})

describe('Rule + Validator: message template (regression)', () => {
    it('replaces every {value} occurrence in a single pass', () => {
        const rules = {
            s: Rule.string().message('got {value}, still {value}'),
        }
        const err = validateError(rules, { s: 42 })
        expect(problemOf(err, 's').description).toBe('got 42, still 42')
    })

    it('does not re-scan substituted values for other placeholders', () => {
        const rules = {
            n: Rule.number().message('value: {value}'),
        }
        const err = validateError(rules, { n: 'see {description} here' })
        expect(problemOf(err, 'n').description).toBe('value: see {description} here')
    })

    it('inserts $& and $$ values literally (no String.replace artifacts)', () => {
        const rules = {
            n: Rule.number().message('value: {value}'),
        }
        const amp = problemOf(validateError(rules, { n: 'a$&b' }), 'n').description
        const dollar = problemOf(validateError(rules, { n: 'a$$b' }), 'n').description
        expect(amp).toBe('value: a$&b')
        expect(dollar).toBe('value: a$$b')
    })

    it('replaces {description} {value} {default} {example} in one pass', () => {
        const rules = {
            n: Rule.number()
                .description('Num')
                .default(10)
                .example(5)
                .message('{description}={default} ex:{example} got {value}'),
        }
        const err = validateError(rules, { n: 'x' })
        expect(problemOf(err, 'n').description).toBe('Num=10 ex:5 got x')
    })
})

describe('Rule + Validator: standardized error arg (regression)', () => {
    it('VR_NUMBER_MAX carries key and limit', () => {
        const err = validateError({ n: Rule.number().max(10) }, { n: 11 })
        expect(problemOf(err, 'n').arg).toEqual({ key: 'n', limit: 10 })
    })

    it('VR_NUMBER_MIN carries key and limit', () => {
        const err = validateError({ n: Rule.number().min(1) }, { n: 0 })
        expect(problemOf(err, 'n').arg).toEqual({ key: 'n', limit: 1 })
    })

    it('VR_NUMBER_INTEGER carries key', () => {
        const err = validateError({ n: Rule.number().integer() }, { n: 1.5 })
        expect(problemOf(err, 'n').arg).toEqual({ key: 'n' })
    })

    it('VR_IS_NOT_ARRAY carries key', () => {
        const err = validateError({ a: Rule.array() }, { a: 5 })
        expect(problemOf(err, 'a').arg).toEqual({ key: 'a' })
    })

    it('VR_ARRAY_CONTENT_ERROR carries key and index', () => {
        const rules = { a: Rule.array().required().content(Rule.string()) }
        const err = validateError(rules, { a: ['x', 42] })
        expect(problemOf(err, 'a').arg).toEqual({ key: 'a', index: 1 })
    })
})

describe('Rule + Validator: toJSON/export safety (regression)', () => {
    it('toJSON() returns a copy: mutating it does not touch the live rule', () => {
        const rule = Rule.string().description('D').default('x')
        const snapshot: any = rule.toJSON()
        snapshot.description = 'HACKED'
        snapshot.default = 'HACKED'
        expect((rule.export() as any).description).toBe('D')
        expect((rule.export() as any).default).toBe('x')
    })

    it('export() preserves a function default (by reference)', () => {
        const fn = () => 42
        const exported: any = Rule.function().default(fn).export()
        expect(exported.default).toBe(fn)
    })

    it('export() clones mutable defaults (no shared reference)', () => {
        const def = { v: 1 }
        const exported: any = Rule.object().default(def).export()
        expect(exported.default).not.toBe(def)
        expect(exported.default).toEqual(def)
    })

    it('export() keeps rule data: require flag, subrules, description, message', () => {
        const exported: any = Rule.string()
            .required()
            .description('D')
            .message('M {value}')
            .maxLength(10)
            .export()
        expect(exported).toEqual({
            type: 'string',
            require: true,
            default: undefined,
            rules: [{ name: 'maxLength', args: 10 }],
            example: undefined,
            description: 'D',
            message: 'M {value}',
        })
    })
})

describe('Rule + Validator: subrule dispatch table (regression)', () => {
    it('checks subrules in the order they were added', () => {
        const err = validateError({ s: Rule.string().minLength(5).maxLength(3) }, { s: 'x' })
        expect(problemOf(err, 's').type).toBe('VR_STRING_MIN_LENGTH')
    })

    it('an unknown subrule name never passes (fail-closed)', () => {
        const rule: any = Rule.string()
        rule.rule.rules.push({ name: 'garbage', args: 1 })
        const err = validateError({ s: rule }, { s: 'x' })
        expect(problemOf(err, 's').type).toBe('VR_TYPE_NOT_EXISTS')
        expect(problemOf(err, 's').arg).toEqual({ key: 's', name: 'garbage' })
    })

    it('keeps the wire name "contain" of the array content subrule (BC)', () => {
        const exported: any = Rule.array().content(Rule.string()).export()
        expect(exported.rules).toHaveLength(1)
        expect(exported.rules[0].name).toBe('contain')
    })
})

describe('Rule + Validator: export cache (regression)', () => {
    it('reuses the deep clone while the rule is unchanged', () => {
        const rule: any = Rule.object().default({ nested: 1 }).fields({ b: Rule.boolean() })
        const a: any = rule.export()
        const b: any = rule.export()
        expect(a).not.toBe(b)                           // per-call snapshot (layer 2 contract)
        expect(a).toEqual(b)
        expect(a.rules).not.toBe(b.rules)               // per-call snapshot
        expect(a.default).toBe(b.default)               // deep state shared from the cache
        expect(a.rules[0].args).toBe(b.rules[0].args)   // deep state shared from the cache
    })

    it('every basic setter invalidates the cache', () => {
        const rule: any = Rule.string().maxLength(5)
        const before: any = rule.export()
        rule.description('D')
        expect(rule.export().description).toBe('D')
        rule.default('x')
        expect(rule.export().default).toBe('x')
        rule.example('ex')
        expect(rule.export().example).toBe('ex')
        rule.message('M')
        expect(rule.export().message).toBe('M')
        rule.required()
        expect(rule.export().require).toBe(true)
        rule.minLength(2)
        expect(rule.export().rules).toHaveLength(2)
        expect(before.rules[0].args).toBe(5)            // the old snapshot is intact
    })

    it('subrule adders invalidate the cache: number/array/object', () => {
        const n: any = Rule.number().max(5)
        const nBefore: any = n.export()
        n.min(1)
        n.integer()
        expect(n.export().rules).toHaveLength(3)
        expect(nBefore.rules).toHaveLength(1)

        const a: any = Rule.array()
        const aBefore: any = a.export()
        a.content(Rule.string())
        expect(a.export().rules).toHaveLength(1)
        expect(aBefore.rules).toHaveLength(0)

        const o: any = Rule.object()
        const oBefore: any = o.export()
        o.fields({ b: Rule.boolean() })
        expect(o.export().rules).toHaveLength(1)
        expect(oBefore.rules).toHaveLength(0)
    })

    it('an old snapshot is not affected by later mutations', () => {
        const rule: any = Rule.object().default({ a: 1 })
        const before: any = rule.export()
        rule.default({ a: 2 })
        expect(before.default).toEqual({ a: 1 })
        expect(rule.export().default).toEqual({ a: 2 })
    })
})

describe('Rule + Validator: subrule name constants (regression)', () => {
    it('SubruleNames exposes the wire names', () => {
        expect(SubruleNames).toEqual({
            minLength: 'minLength',
            maxLength: 'maxLength',
            min: 'min',
            max: 'max',
            integer: 'integer',
            contain: 'contain',
            fields: 'fields',
        })
    })

    it('subrule names are typed (a typo is a compile error)', () => {
        const name: SubruleName = SubruleNames.contain
        expect(name).toBe('contain')
        // @ts-expect-error an unknown subrule name must not be a valid SubruleName
        const bad: SubruleName = 'minLenght'
        expect(typeof bad).toBe('string')
    })
})

