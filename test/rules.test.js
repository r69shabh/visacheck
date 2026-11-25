import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { audit, dateDay, isoDay, SCHENGEN, shiftMonths } from '../src/rules.js';
import { trip } from './fixture.js';

const check = (data, title) => audit(data).checks.find((item) => item.title === title);

test('valid inputs meet the core checks and have official references', () => {
  const result = audit(trip());
  assert.equal(result.consulate, 'France');
  assert.equal(result.nights, 6);
  assert.equal(result.checks.filter(({ status }) => status === 'error').length, 0);
  assert.ok(result.checks.every(({ source }) => source[1].startsWith('https://')));
  assert.equal(result.documents.find(({ key }) => key === 'photos').ready, true);
  assert.equal(result.documents.find(({ key }) => key === 'bank').ready, false);
});

test('passport needs document validity, age and blank pages; dates are calendar-based', () => {
  assert.equal(isoDay(shiftMonths(dateDay('2026-11-30'), 3)), '2027-02-28');
  assert.equal(dateDay('2026-02-29'), null);
  const data = { ...trip(), passportExpiry: '2027-07-07', passportIssue: '2017-04-02', blank: '1' };
  for (const title of ['Passport expiry', 'Passport issue date', 'Blank passport pages']) {
    assert.equal(check(data, title).status, 'error');
  }
  assert.equal(check({ ...trip(), passportExpiry: '2027-07-08' }, 'Passport eligibility').status, 'ok');
});

test('standard filing window is six calendar months and 15 days, not a fixed 180 days', () => {
  assert.equal(check({ ...trip(), application: '2026-10-02' }, 'Application timing').status, 'ok');
  assert.equal(check({ ...trip(), application: '2026-10-01' }, 'Application timing').status, 'error');
  assert.equal(check({ ...trip(), application: '2027-03-18' }, 'Application timing').status, 'ok');
  assert.equal(check({ ...trip(), application: '2027-03-19' }, 'Application timing').status, 'warning');
  assert.equal(check({ ...trip(), application: '2027-04-03' }, 'Application timing').status, 'error');
});

test('consulate uses main purpose, then duration, then first external entry for unresolved ties', () => {
  const data = trip();
  assert.equal(check({ ...data, consulate: 'Italy' }, 'Destination consulate').status, 'error');
  assert.equal(audit({ ...data, purpose: 'family', mainPurpose: 'Italy' }).consulate, 'Italy');
  data.segments[0] = { ...data.segments[0], to: '2027-04-05', nights: '3' };
  data.segments[1] = { ...data.segments[1], from: '2027-04-05', nights: '3' };
  assert.equal(audit({ ...data, firstEntry: 'Germany' }).consulate, 'Germany');
  assert.equal(audit({ ...data, firstEntry: '' }).consulate, '');
});

test('same-day visit to a sole destination uses that country and requires no overnight stay', () => {
  const data = {
    ...trip(), exit: '2027-04-02', firstEntry: '', purpose: 'business', hotels: [],
    segments: [{ country: 'France', city: 'Paris', from: '2027-04-02', to: '2027-04-02', nights: '0' }],
  };
  assert.equal(audit(data).consulate, 'France');
  assert.equal(check(data, 'Accommodation dates').status, 'ok');
});

test('rolling stay limit counts entry and exit and deduplicates prior dates', () => {
  const data = { ...trip(), history: 'yes', previous: [
    { from: '2027-01-01', to: '2027-03-24' }, { from: '2027-01-05', to: '2027-01-10' },
  ] };
  assert.match(check(data, '90 days in any 180').reason, /90 days/);
  assert.equal(check(data, '90 days in any 180').status, 'ok');
  data.priorVisa = 'yes';
  data.previous[0].to = '2027-03-25';
  assert.equal(check(data, '90 days in any 180').status, 'error');
  assert.equal(check({ ...data, previous: [{ from: '2026-04-01', to: '2026-06-29' }] }, '90 days in any 180').status, 'ok');
  assert.equal(check({ ...data, previous: [] }, '90 days in any 180').status, 'warning');
});

test('flags inconsistent accommodation, itinerary and flights', () => {
  const data = trip();
  data.hotels[0].to = '2027-04-05';
  data.hotels[1].city = 'Venice';
  data.hotels.push({ city: 'Rome', from: '2027-04-06', to: '2027-04-07' });
  data.returnDate = '2027-04-09';
  assert.match(check(data, 'Accommodation gaps').reason, /2027-04-05/);
  assert.equal(check(data, 'Accommodation city mismatch').status, 'error');
  assert.equal(check(data, 'Overlapping bookings').status, 'warning');
  assert.equal(check(data, 'Flight date mismatch').status, 'error');
  data.segments[1].from = '2027-04-07';
  assert.equal(check(data, 'Itinerary continuity').status, 'error');
});

test('Schengen list includes Bulgaria and Romania, not UK, Ireland or Cyprus', () => {
  assert.equal(SCHENGEN.length, 29);
  assert.ok(SCHENGEN.includes('Bulgaria') && SCHENGEN.includes('Romania'));
  for (const country of ['UK', 'Ireland', 'Cyprus']) {
    const data = trip();
    data.segments[0].country = country;
    assert.equal(check(data, 'Schengen destinations').status, 'error');
  }
});

test('insurance checks limit, whole trip and territory independently', () => {
  const data = { ...trip(), currency: 'INR', coverage: '2999999', fx: '100', insTo: '2027-04-07', wide: 'no' };
  for (const title of ['Insurance amount', 'Insurance dates', 'Insurance territory']) {
    assert.equal(check(data, title).status, 'error');
  }
  assert.equal(check({ ...data, coverage: '3000000' }, 'Insurance amount').status, 'ok');
  assert.equal(check({ ...data, fx: '' }, 'Insurance conversion').status, 'warning');
});
