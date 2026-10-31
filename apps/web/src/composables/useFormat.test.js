import { describe, expect, it } from 'vitest'
import { formatTaxService, number, parseTaxService, toInt } from './useFormat'

describe('useFormat', () => {
  it('toInt membuang pemisah ribuan', () => {
    expect(toInt('Rp 28.000')).toBe(28000)
    expect(toInt('')).toBe(0)
  })
  it('number memakai format Indonesia', () => {
    expect(number(126500)).toBe('126.500')
  })
  it('parseTaxService membaca satu kolom pajak + service', () => {
    expect(parseTaxService('10% + 5%')).toEqual({ tax: 10, service: 5 })
    expect(parseTaxService('10+5')).toEqual({ tax: 10, service: 5 })
    expect(parseTaxService('11')).toEqual({ tax: 11, service: 0 })
    expect(parseTaxService('7,5 + 2,5')).toEqual({ tax: 7.5, service: 2.5 })
    expect(parseTaxService('')).toEqual({ tax: 0, service: 0 })
    expect(parseTaxService('150 + 5').tax).toBe(100)
    expect(formatTaxService(10, 5)).toBe('10% + 5%')
  })
})
