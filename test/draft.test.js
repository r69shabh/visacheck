import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hasTripEntries } from '../src/draft.js';

test('sample confirmation detects any live form entries without relying on storage', () => {
  const blank = {
    name: '', currency: 'EUR', segments: [{ city: '', nights: '' }], hotels: [{ city: '' }],
    previous: [{ from: '' }], documents: { photos: false },
  };
  assert.equal(hasTripEntries(blank), false);
  for (const entries of [
    { name: 'Alex Reyes' }, { currency: 'LOCAL' }, { segments: [{ nights: '0' }] },
    { hotels: [{ city: 'Paris' }] }, { previous: [{ from: '2027-02-05' }] }, { documents: { photos: true } },
  ]) {
    assert.equal(hasTripEntries({ ...blank, ...entries }), true);
  }
});
