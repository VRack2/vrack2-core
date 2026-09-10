/**
 * Unit tests for ImportManager: path helpers, class/json import,
 * directory listing and vrack-style import strings.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { ImportManager, Container, ErrorManager } from 'vrack2-core'

describe('ImportManager: vrack-style import strings', () => {
    it('camelize() converts dotted names to camelCase', () => {
        expect(ImportManager.camelize('input.device.port')).toBe('inputDevicePort')
        expect(ImportManager.camelize('Action.test')).toBe('actionTest')
        expect(ImportManager.camelize('set.value')).toBe('setValue')
    })

    it('importClassName() returns the class part', () => {
        expect(ImportManager.importClassName('vrack2-core.Container')).toBe('Container')
    })

    it('importVendorName() returns the vendor part', () => {
        expect(ImportManager.importVendorName('vrack2-core.Container')).toBe('vrack2-core')
    })

    it('importClass() resolves vrack2-core.Container to the Container class', async () => {
        const cls = await ImportManager.importClass('vrack2-core.Container')
        expect(cls).toBe(Container)
    })

    it('importClass() throws IM_CLASS_VENDOR_ERROR for an unknown vendor', async () => {
        let err: any
        try {
            await ImportManager.importClass('no-such-vendor-xyz.Foo')
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'IM_CLASS_VENDOR_ERROR')).toBe(true)
        expect(err.path).toBe('no-such-vendor-xyz.Foo')
    })
})

describe('ImportManager: json and files', () => {
    it('importJSON() reads and parses an existing file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack-im-'))
        const fp = path.join(dir, 'data.json')
        fs.writeFileSync(fp, JSON.stringify({ a: 1, b: [1, 2], c: { d: 'x' } }))

        expect(ImportManager.importJSON(fp)).toEqual({ a: 1, b: [1, 2], c: { d: 'x' } })
    })

    it('importJSON() throws IM_FILE_NOT_FOUND for a missing file', () => {
        let err: any
        try {
            ImportManager.importJSON('/no/such/file-xyz.json')
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'IM_FILE_NOT_FOUND')).toBe(true)
    })

    it('tryJsonParse() throws IM_JSON_INCORRECT on malformed json', () => {
        let err: any
        try {
            ImportManager.tryJsonParse('{ definitely not json')
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'IM_JSON_INCORRECT')).toBe(true)
        expect(err.jsonRaw).toBe('{ definitely not json')
    })

    it('dirList() / fileList() / isDir() / isFile() report directory content', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack-im-'))
        fs.mkdirSync(path.join(dir, 'subdir'))
        fs.writeFileSync(path.join(dir, 'file.txt'), 'x')

        expect(ImportManager.dirList(dir)).toEqual(['subdir'])
        expect(ImportManager.fileList(dir)).toEqual(['file.txt'])
        expect(ImportManager.isDir(dir)).toBe(true)
        expect(ImportManager.isDir(path.join(dir, 'file.txt'))).toBe(false)
        expect(ImportManager.isFile(path.join(dir, 'file.txt'))).toBe(true)
        expect(ImportManager.isFile(path.join(dir, 'subdir'))).toBe(false)
    })

    it('systemPath() returns the process working directory', () => {
        expect(ImportManager.systemPath()).toBe(process.cwd())
    })
})