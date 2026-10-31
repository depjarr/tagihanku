import { calculateSplit, distribute } from './split.calculator';

const people = [
  { id: 'a', name: 'Andi' },
  { id: 'b', name: 'Budi' },
  { id: 'c', name: 'Citra' },
];

describe('distribute', () => {
  it('jumlah hasil selalu sama dengan total', () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(distribute(10, [0, 0])).toEqual([0, 0]);
    expect(distribute(7, [3, 3, 1]).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

describe('calculateSplit (contoh dari mockup)', () => {
  const input = {
    participants: people,
    taxPercent: 10,
    servicePercent: 5,
    items: [
      { id: '1', price: 28000, participantIds: ['a'] },
      { id: '2', price: 25000, participantIds: ['b'] },
      { id: '3', price: 42000, participantIds: ['a', 'c'] }, // dibagi
      { id: '4', price: 15000, participantIds: ['a', 'b', 'c'] }, // es teh x3
    ],
  };

  it('menghasilkan 62.100 / 34.500 / 29.900 dengan total 126.500', () => {
    const r = calculateSplit(input);
    expect(r.shares.map((s) => s.itemTotal)).toEqual([54000, 30000, 26000]);
    expect(r.shares.map((s) => s.feeTotal)).toEqual([8100, 4500, 3900]);
    expect(r.shares.map((s) => s.total)).toEqual([62100, 34500, 29900]);
    expect(r.grandTotal).toBe(126500);
    expect(r.expectedTotal).toBe(126500);
    expect(r.unassignedItemIds).toEqual([]);
  });

  it('item tanpa peserta dilaporkan dan tidak ikut dibagi', () => {
    const r = calculateSplit({ ...input, items: [...input.items, { id: '5', price: 10000, participantIds: [] }] });
    expect(r.unassignedItemIds).toEqual(['5']);
    expect(r.unassignedSubtotal).toBe(10000);
    expect(r.grandTotal).toBe(126500);
  });

  it('sisa rupiah tidak hilang saat tidak habis dibagi', () => {
    const r = calculateSplit({
      participants: people,
      taxPercent: 11,
      servicePercent: 0,
      items: [{ id: '1', price: 100000, participantIds: ['a', 'b', 'c'] }],
    });
    expect(r.grandTotal).toBe(111000);
    expect(r.shares.map((s) => s.total).sort()).toEqual([36999, 37000, 37001]);
  });
});
