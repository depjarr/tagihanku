import { describe, expect, it } from 'vitest'
import { crc16, hasAmount, isValidQris, merchantName, parseTlv, tlv, toDynamicQris } from './useQris'

// QRIS statis contoh (dibuat untuk tes; CRC dihitung di bawah)
const body =
  tlv('00', '01') + tlv('01', '11') +
  tlv('26', tlv('00', 'ID.CO.EXAMPLE.WWW') + tlv('01', '936009143000000001') + tlv('02', '936000140000000001') + tlv('03', 'UMI')) +
  tlv('52', '5812') + tlv('53', '360') + tlv('58', 'ID') + tlv('59', 'byhwawon - Food') + tlv('60', 'JAKARTA') +
  tlv('61', '10110') + tlv('62', tlv('07', 'A01')) + '6304'
const STATIC = body + crc16(body)

describe('useQris', () => {
  it('crc16 sesuai vektor uji CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
  it('mengenali QRIS valid dan menolak yang rusak', () => {
    expect(isValidQris(STATIC)).toBe(true)
    expect(isValidQris(STATIC.slice(0, -1) + '0')).toBe(false)
    expect(isValidQris('halo')).toBe(false)
  })
  it('membaca nama merchant', () => {
    expect(merchantName(STATIC)).toBe('byhwawon - Food')
    expect(hasAmount(STATIC)).toBe(false)
  })
  it('toDynamicQris: tag 01=12, tag 54 nominal, CRC valid, urutan tag naik', () => {
    const dyn = toDynamicQris(STATIC, 29900)
    expect(isValidQris(dyn)).toBe(true)
    const tags = parseTlv(dyn)
    expect(tags.find((t) => t.id === '01').val).toBe('12')
    expect(tags.find((t) => t.id === '54').val).toBe('29900')
    const ids = tags.map((t) => t.id)
    expect(ids).toEqual([...ids].sort())
    expect(ids.at(-1)).toBe('63')
    expect(merchantName(dyn)).toBe('byhwawon - Food')
  })
  it('mengganti nominal lama, tidak menggandakan tag 54', () => {
    const twice = toDynamicQris(toDynamicQris(STATIC, 1000), 2500)
    expect(parseTlv(twice).filter((t) => t.id === '54')).toHaveLength(1)
    expect(parseTlv(twice).find((t) => t.id === '54').val).toBe('2500')
  })
  it('menolak nominal nol', () => {
    expect(() => toDynamicQris(STATIC, 0)).toThrow()
  })
})
