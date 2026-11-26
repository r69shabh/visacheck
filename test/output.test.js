import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { GUMROAD_PRODUCT_ID } from '../src/config.js';
import { verifyLicense } from '../src/payment.js';
import { coverLetter, itineraryPdf } from '../src/pdfs.js';
import { audit } from '../src/rules.js';
import { trip } from './fixture.js';

const success = (purchase) => new Response(JSON.stringify({ success: true, purchase }));

test('Gumroad verify posts only product ID and key and rejects invalid or refunded licenses', async () => {
  const purchase = { product_id: GUMROAD_PRODUCT_ID };
  assert.equal(await verifyLicense('test-key', async (url, options) => {
    assert.equal(url, 'https://api.gumroad.com/v2/licenses/verify');
    assert.equal(options.method, 'POST');
    assert.deepEqual(Object.fromEntries(options.body), {
      product_id: GUMROAD_PRODUCT_ID, license_key: 'test-key', increment_uses_count: 'false',
    });
    return success(purchase);
  }), true);
  for (const invalid of [{ refunded: true }, { chargebacked: true }, { disputed: true }, { product_id: 'different' }]) {
    assert.equal(await verifyLicense('test-key', async () => success({ ...purchase, ...invalid })), false);
  }
  assert.equal(await verifyLicense('invalid', async () => new Response(null, { status: 404 })), false);
  await assert.rejects(verifyLicense('test-key', async () => new Response(null, { status: 503 })));
});

function pdfText(pdf) {
  const output = pdf.output();
  assert.match(output, /^%PDF-/);
  return [...output.matchAll(/\bstream\n([\s\S]*?)\nendstream/g)].map((match) => inflateSync(Buffer.from(match[1], 'latin1')).toString()).join('\n');
}

test('PDFs include calculated consulate, individual trip days, and the disclaimer', () => {
  const data = trip();
  const review = audit(data);
  const cover = pdfText(coverLetter(data, review));
  const itinerary = pdfText(itineraryPdf(data, review));
  assert.match(cover, /Consular Section - France/);
  assert.match(cover, /Alex Reyes.*A1234567.*issued by Philippines/);
  assert.match(cover, /Current residence: Dubai, United Arab Emirates/);
  assert.doesNotMatch(cover, /India/);
  assert.match(itinerary, /Day 1 \| 2027-04-02 \| Paris, France/);
  assert.match(itinerary, /Day 5 \| 2027-04-06 \| Rome, Italy/);
  assert.match(itinerary, /Day 7 \| 2027-04-08 \| Rome, Italy/);
  assert.match(itinerary, /Schengen departure from FCO/);
  for (const pdf of [cover, itinerary]) assert.match(pdf, /Not legal or visa advice/);
});

test('both PDFs embed non-ASCII Latin letters from the passport name', () => {
  const data = { ...trip(), name: 'Łukasz Østergård' };
  const review = audit(data);
  for (const pdf of [coverLetter(data, review), itineraryPdf(data, review)]) {
    const text = pdfText(pdf);
    const glyphs = new Map([...text.matchAll(/<([a-f0-9]{4})><([a-f0-9]{4})>/g)]
      .map(([, glyph, unicode]) => [String.fromCharCode(parseInt(unicode, 16)), glyph]));
    assert.ok([...data.name].every((letter) => glyphs.has(letter)));
    const name = [...data.name].map((letter) => glyphs.get(letter)).join('');
    assert.ok([...text.matchAll(/<([a-f0-9]+)> Tj/g)].some(([, run]) => run.includes(name)));
  }
  for (const generate of [coverLetter, itineraryPdf]) {
    assert.throws(() => generate({ ...data, name: 'Alex 🙂' }, review), { name: 'UnsupportedPdfTextError' });
  }
});

test('itinerary records each transfer on the departure day and on same-day trips', () => {
  const data = trip();
  const stops = [
    { country: 'Italy', city: 'Milan', from: data.exit, to: data.exit, nights: '0' },
    { country: 'Switzerland', city: 'Geneva', from: data.exit, to: data.exit, nights: '0' },
  ];
  data.segments.push(...stops);
  const output = pdfText(itineraryPdf(data, audit(data)));
  assert.match(output, /Onward travel from Rome, Italy to Milan, Italy[\s\S]*Onward travel from Milan, Italy to Geneva, Switzerland[\s\S]*Schengen departure/);
  const sameDay = { ...data, entry: data.exit, segments: stops, firstEntry: 'Italy' };
  const sameDayOutput = pdfText(itineraryPdf(sameDay, audit(sameDay)));
  assert.match(sameDayOutput, /Schengen arrival[\s\S]*Onward travel from Milan, Italy to Geneva, Switzerland[\s\S]*Schengen departure/);
  for (const text of [output, sameDayOutput]) {
    assert.equal(text.match(/Schengen arrival/g)?.length, 1);
    assert.equal(text.match(/Schengen departure/g)?.length, 1);
  }
});
