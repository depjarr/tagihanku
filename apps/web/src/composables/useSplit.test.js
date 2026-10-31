import { describe, expect, it } from 'vitest'
import { computeSplit, distribute, itemShares, modeBalance } from './useSplit'

const sum = (a) => a.reduce((x, y) => x + y, 0)

describe('distribute', () => {
  it('jumlah selalu pas, sisa dibagi ke pecahan terbesar', () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(sum(distribute(10001, [3, 5, 7, 11]))).toBe(10001)
  })
  it('bobot nol tidak kebagian', () => {
    expect(distribute(1000, [1, 0, 1])).toEqual([500, 0, 500])
  })
  it('semua bobot nol → semua nol', () => {
    expect(distribute(1000, [0, 0])).toEqual([0, 0])
  })
  it('total negatif (diskon) tetap pas', () => {
    const r = distribute(-1001, [1, 1])
    expect(sum(r)).toBe(-1001)
  })
})

describe('itemShares per mode', () => {
  const ids = ['a', 'b', 'c']
  it('rata', () => {
    const s = itemShares({ price: 30000, splitMode: 'equal', assignedTo: ['a', 'b'] }, ids)
    expect(s).toEqual({ a: 15000, b: 15000, c: 0 })
  })
  it('porsi 2:1', () => {
    const s = itemShares({ price: 30000, splitMode: 'shares', weights: { a: 2, b: 1 } }, ids)
    expect(s).toEqual({ a: 20000, b: 10000, c: 0 })
  })
  it('persen 50/30/20', () => {
    const s = itemShares({ price: 10000, splitMode: 'percent', weights: { a: 50, b: 30, c: 20 } }, ids)
    expect(s).toEqual({ a: 5000, b: 3000, c: 2000 })
  })
  it('nominal', () => {
    const s = itemShares({ price: 10000, splitMode: 'amount', weights: { a: 7000, b: 3000 } }, ids)
    expect(s).toEqual({ a: 7000, b: 3000, c: 0 })
    expect(modeBalance({ price: 10000, splitMode: 'amount', weights: { a: 7000 } }, ids).diff).toBe(3000)
  })
})

describe('computeSplit', () => {
  it('pajak+service sebanding dan total anggota = total tagihan', () => {
    const items = [
      { id: 1, name: 'Nasi', price: 40000, splitMode: 'equal', assignedTo: ['a'] },
      { id: 2, name: 'Pizza', price: 60000, splitMode: 'shares', weights: { a: 1, b: 2 } },
    ]
    const r = computeSplit({ items, memberIds: ['a', 'b'], tax: 10000, serviceCharge: 5000 })
    expect(r.grandTotal).toBe(100000 + 15000)
    expect(r.rows.find((x) => x.id === 'a').itemSubtotal).toBe(60000)
    expect(r.rows.find((x) => x.id === 'b').itemSubtotal).toBe(40000)
    expect(r.unassigned).toHaveLength(0)
  })
  it('diskon mengurangi tagihan', () => {
    const items = [{ id: 1, name: 'x', price: 100000, splitMode: 'equal', assignedTo: ['a', 'b'] }]
    const r = computeSplit({ items, memberIds: ['a', 'b'], discount: 10000 })
    expect(r.grandTotal).toBe(90000)
  })
  it('item tanpa peserta dilaporkan', () => {
    const r = computeSplit({ items: [{ id: 1, name: 'x', price: 5000, splitMode: 'equal', assignedTo: [] }], memberIds: ['a'] })
    expect(r.unassigned).toHaveLength(1)
    expect(r.grandTotal).toBe(0)
  })
})