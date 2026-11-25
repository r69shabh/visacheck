import { audit, dateDay, DOCUMENTS, isoDay, SCHENGEN, SOURCES } from './rules.js';
import { GUMROAD_PRODUCT_ID, GUMROAD_PRODUCT_URL } from './config.js';
import { verifyLicense } from './payment.js';

const $ = (id) => document.getElementById(id);
const form = $('trip-form');
const draftKey = 'visacheck-trip-v1';
const unlockKey = 'visacheck-unlock-' + GUMROAD_PRODUCT_ID;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', dateStyle: 'short' }).format(new Date());
const countryOptions = [...SCHENGEN.map((name) => [name, name]), ['Other / non-Schengen', 'Other / non-Schengen']];
const consulateOptions = SCHENGEN.map((name) => [name, name]);
const yesNo = [['yes', 'Yes'], ['no', 'No']];
const purposes = [['tourism', 'Tourism'], ['business', 'Business'], ['family', 'Family visit']];
const groups = {
  applicant: [
    ['name', 'Full name (Latin spelling)', 'text', 'Name on your passport'],
    ['passport', 'Indian passport number', 'text', 'e.g. A1234567'],
    ['passportIssue', 'Passport issue date', 'date'],
    ['passportExpiry', 'Passport expiry date', 'date'],
    ['blank', 'Number of blank passport pages', 'number', 'e.g. 2'],
    ['city', 'City of residence in India', 'text', 'e.g. Pune'],
    ['state', 'State / union territory', 'text', 'e.g. Maharashtra'],
  ],
  trip: [
    ['purpose', 'Main purpose', purposes],
    ['application', 'Planned filing date (defaults to today)', 'date'],
    ['entry', 'First Schengen entry', 'date'],
    ['exit', 'Final Schengen exit', 'date'],
    ['firstEntry', 'Country of first external entry', countryOptions],
    ['consulate', 'Consulate you plan to apply to', consulateOptions],
    ['mainPurpose', 'Main-purpose country (if one stands out)', consulateOptions, 'None / not specified'],
  ],
  history: [['history', 'Any short stays in the prior 179 days?', [['none', 'No'], ['yes', 'Yes'], ['unknown', 'Not sure']]]],
  flights: [
    ['outDate', 'Flight arrival date (in Schengen)', 'date'],
    ['outAirport', 'First arrival airport (Schengen)', 'text', 'e.g. CDG'],
    ['returnDate', 'Flight departure date (from Schengen)', 'date'],
    ['returnAirport', 'Final departure airport (Schengen)', 'text', 'e.g. FCO'],
  ],
  insurance: [
    ['coverage', 'Medical coverage limit', 'number', 'e.g. 30000'],
    ['currency', 'Coverage currency', [['EUR', 'EUR (€)'], ['INR', 'INR (₹)']]],
    ['fx', 'INR per €1 (for INR only)', 'number', 'Current published rate'],
    ['insFrom', 'First day covered', 'date'],
    ['insTo', 'Last day covered', 'date'],
    ['wide', 'Covers all Schengen countries?', yesNo],
  ],
  support: [
    ['employment', 'Work or study status', 'text', 'e.g. Salaried software engineer'],
    ['funds', 'Trip funding', 'text', 'e.g. Self-funded from savings'],
    ['priorVisa', 'Previously held a Schengen visa?', yesNo],
  ],
};
const repeat = {
  segments: ['Itinerary stop', [
    ['country', 'Country', countryOptions], ['city', 'City', 'text', 'e.g. Paris'],
    ['from', 'Start date', 'date'], ['to', 'End date', 'date'], ['nights', 'Nights', 'number', 'e.g. 3'],
  ]],
  hotels: ['Accommodation', [['city', 'Booking city', 'text', 'e.g. Paris'], ['from', 'Check-in date', 'date'], ['to', 'Checkout date', 'date']]],
  previous: ['Past stay', [['from', 'Entry date', 'date'], ['to', 'Exit date', 'date']]],
};

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function field([key, label, type, hint], value = '', isRow = false) {
  const wrapper = el('label', '', label);
  let input;
  if (Array.isArray(type)) {
    input = el('select');
    if (key !== 'currency') input.add(new Option(hint || 'Select…', ''));
    type.forEach(([option, text]) => input.add(new Option(text, option)));
  } else {
    input = el('input');
    input.type = type;
    if (hint) input.placeholder = hint;
    if (type === 'number') {
      input.min = '0';
      input.step = ['coverage', 'fx'].includes(key) ? 'any' : '1';
    }
    if (type === 'text') input.maxLength = key === 'passport' ? 32 : 120;
    if (key === 'passport') {
      input.autocomplete = 'off';
      input.spellcheck = false;
    }
  }
  if (key === 'currency' && !value) value = 'EUR';
  if (key === 'application') input.setAttribute('aria-label', 'Planned filing date (defaults to today if blank)');
  if (key === 'fx') wrapper.hidden = true;
  input.value = value;
  if (isRow) input.dataset.field = key;
  else input.name = key;
  wrapper.append(input);
  return wrapper;
}

function numberRows(kind) {
  [...$(kind).children].forEach((row, i) => {
    const name = repeat[kind][0] + ' ' + (i + 1);
    row.querySelector('legend').textContent = name;
    row.querySelector('button').setAttribute('aria-label', 'Remove ' + name.toLowerCase());
  });
}

function addRow(kind, values = {}, focus = false) {
  const [, fields] = repeat[kind];
  const row = el('fieldset', 'row');
  const layout = el('div', 'fields');
  fields.forEach((config) => layout.append(field(config, values[config[0]], true)));
  const remove = el('button', 'button text-button', 'Remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    row.remove();
    numberRows(kind);
    saveDraft();
    if (reviewed) renderReview();
    form.querySelector(`[data-add="${kind}"]`).focus();
  });
  row.append(el('legend'), layout, remove);
  $(kind).append(row);
  numberRows(kind);
  if (focus) row.querySelector('[data-field]').focus();
}

function fill(data = {}, defaultRows = false) {
  for (const [group, fields] of Object.entries(groups)) {
    $(group + '-fields').replaceChildren(...fields.map((config) => field(config, data[config[0]])));
  }
  for (const kind of Object.keys(repeat)) {
    $(kind).replaceChildren();
    const rows = Array.isArray(data[kind]) ? data[kind] : [];
    (defaultRows && kind !== 'previous' && !rows.length ? [{}] : rows).forEach((row) => addRow(kind, row));
  }
  $('document-fields').replaceChildren(...DOCUMENTS.map(([key, label, note, applicable]) => {
    const wrapper = el('label', 'document');
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(data.documents?.[key]);
    checkbox.dataset.doc = key;
    if (applicable) wrapper.dataset.applicable = applicable.join(' ');
    const desc = el('span', '', label);
    desc.append(el('small', '', note));
    wrapper.append(checkbox, desc);
    return wrapper;
  }));
  setConditionalFields();
}

function setConditionalFields() {
  form.elements.fx.parentElement.hidden = form.elements.currency.value !== 'INR';
  for (const wrapper of form.querySelectorAll('[data-applicable]')) {
    wrapper.hidden = !wrapper.dataset.applicable.split(' ').includes(form.elements.purpose.value);
  }
}

function getData() {
  const result = Object.fromEntries(new FormData(form));
  for (const kind of Object.keys(repeat)) {
    result[kind] = [...$(kind).children].map((row) => Object.fromEntries(
      [...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value]),
    ));
  }
  result.documents = Object.fromEntries([...form.querySelectorAll('[data-doc]')].map((box) => [box.dataset.doc, box.checked]));
  return result;
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey)) || {};
  } catch {
    return {};
  }
}

function saveDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(getData()));
    $('storage-status').textContent = '';
  } catch {
    $('storage-status').textContent = 'This browser could not save your draft. Your entries will be lost on reload.';
  }
}

const initial = loadDraft();
fill(initial, !Object.keys(initial).length);
$('fx-source').href = SOURCES.fx[1];
const waiting = $('review-body').firstElementChild.cloneNode(true);
let reviewed = false;

function renderReview(focus = false) {
  const data = getData();
  const result = audit(data, today());
  const statuses = [['error', 'Errors'], ['warning', 'Warnings'], ['ok', 'OK']];
  const summary = el('div', 'summary');
  const openGroups = new Map([...$('review-body').querySelectorAll('details')].map((group) => [group.dataset.status, group.open]));
  const sections = statuses.map(([status, title]) => {
    const matching = result.checks.filter((check) => check.status === status);
    summary.append(el('span', 'pill ' + status, `${title} ${matching.length}`));
    if (!matching.length) return null;
    const section = el('details', 'result-group');
    section.dataset.status = status;
    section.open = focus || !openGroups.has(status) ? status !== 'ok' : openGroups.get(status);
    const list = el('ul');
    for (const item of matching) {
      const row = el('li', 'result-item ' + status);
      const link = el('a', '', item.source[0] + ' ↗');
      link.href = item.source[1];
      link.target = '_blank';
      link.rel = 'noopener';
      row.append(el('strong', '', item.title), el('p', '', item.reason), link);
      list.append(row);
    }
    section.append(el('summary', '', title), list);
    return section;
  }).filter(Boolean);
  const ready = result.documents.filter((item) => item.ready).length;
  const docs = el('section', 'result-group');
  const list = el('ul');
  result.documents.forEach((item) => list.append(el('li', 'result-item ' + (item.ready ? 'ok' : 'warning'), (item.ready ? '✓ ' : '□ ') + item.label)));
  docs.append(el('h4', '', `Documents ready: ${ready} / ${result.documents.length}`), list);
  $('review-body').replaceChildren(summary, ...sections, docs);
  $('letter-preview').textContent = 'To the Visa Officer' + (result.consulate ? ', Consular Section — ' + result.consulate : '') +
    '\nSubject: Short-stay visa application' + (result.validTrip ? ' | ' + data.entry + ' to ' + data.exit : '');
  reviewed = true;
  if (focus) $('review').focus();
}

form.addEventListener('input', saveDraft);
form.addEventListener('change', () => {
  setConditionalFields();
  if (reviewed) renderReview();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  renderReview(true);
});
form.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
  addRow(button.dataset.add, {}, true);
  saveDraft();
}));

$('sample').addEventListener('click', () => {
  if (Object.keys(loadDraft()).length && !window.confirm('Replace the current trip draft with the sample trip?')) return;
  const now = dateDay(today());
  const day = (offset) => isoDay(now + offset);
  fill({
    name: 'Aarav Mehta', passport: 'A1234567', passportIssue: day(-800), passportExpiry: day(1500), blank: '3',
    city: 'Pune', state: 'Maharashtra', purpose: 'tourism', application: today(), entry: day(42), exit: day(50),
    firstEntry: 'France', consulate: 'Italy', history: 'none', outDate: day(42), outAirport: 'CDG',
    returnDate: day(50), returnAirport: 'FCO', coverage: '25000', currency: 'EUR', insFrom: day(42),
    insTo: day(49), wide: 'yes', employment: 'Salaried employee', funds: 'Self-funded from savings', priorVisa: 'no',
    segments: [
      { country: 'France', city: 'Paris', from: day(42), to: day(47), nights: '5' },
      { country: 'Italy', city: 'Rome', from: day(47), to: day(50), nights: '3' },
    ],
    hotels: [{ city: 'Paris', from: day(42), to: day(46) }, { city: 'Rome', from: day(47), to: day(50) }],
    documents: { form: true, photos: true, transport: true },
  });
  saveDraft();
  renderReview(true);
});

$('clear-trip').addEventListener('click', () => {
  if (!window.confirm('Delete this trip draft from this browser?')) return;
  try {
    localStorage.removeItem(draftKey);
    $('storage-status').textContent = 'Trip data cleared.';
  } catch {
    $('storage-status').textContent = 'Could not clear stored data. Clear this site’s data in your browser settings.';
  }
  fill({}, true);
  reviewed = false;
  $('review-body').replaceChildren(waiting.cloneNode(true));
  $('letter-preview').textContent = 'To the Visa Officer\nSubject: Short-stay visa application';
});

function showUnlock(unlocked) {
  $('locked').hidden = unlocked;
  $('unlocked').hidden = !unlocked;
}

let unlocked = false;
const enabled = Boolean(GUMROAD_PRODUCT_ID && GUMROAD_PRODUCT_URL);
$('buy').hidden = !enabled;
$('unlock-form').hidden = !enabled;
$('unavailable').hidden = enabled;
if (enabled) {
  $('buy').href = GUMROAD_PRODUCT_URL;
  try { unlocked = localStorage.getItem(unlockKey) === 'verified'; } catch { /* use memory */ }
}
showUnlock(unlocked);

$('unlock-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('license');
  const key = input.value.trim();
  if (!enabled || !key || $('unlock').disabled) return;
  $('unlock').disabled = true;
  $('payment-status').textContent = 'Verifying with Gumroad…';
  try {
    if (!await verifyLicense(key)) {
      $('payment-status').textContent = 'That license could not be verified for this PDF pack. Check the key in your Gumroad receipt.';
      return;
    }
    unlocked = true;
    input.value = '';
    showUnlock(true);
    try {
      localStorage.setItem(unlockKey, 'verified');
      $('payment-status').textContent = 'Your PDF pack is ready.';
    } catch {
      $('payment-status').textContent = 'Unlocked for this visit only; browser storage is unavailable.';
    }
    $('cover-download').focus();
  } catch {
    $('payment-status').textContent = 'Couldn’t reach Gumroad to verify the key. Please try again.';
  } finally {
    $('unlock').disabled = false;
  }
});

$('forget-license').addEventListener('click', () => {
  unlocked = false;
  showUnlock(false);
  try {
    localStorage.removeItem(unlockKey);
    $('payment-status').textContent = 'Unlock removed from this browser.';
  } catch {
    $('payment-status').textContent = 'Clear this site’s storage in browser settings to remove a saved unlock.';
  }
  $('license').focus();
});

async function downloadPdf(kind) {
  if (!unlocked) return;
  const data = getData();
  const review = audit(data, today());
  if (!data.name?.trim() || !review.consulate || review.nights === null || review.nights >= 90 ||
    (kind === 'cover' && (!data.passport?.trim() || !Object.hasOwn(Object.fromEntries(purposes), data.purpose)))) {
    $('payment-status').textContent = 'Add your passport details, trip purpose and a complete short-stay itinerary with a determinable consulate, then try again.';
    return;
  }
  try {
    const { coverLetter, itineraryPdf } = await import('./pdfs.js');
    if (kind === 'cover') coverLetter(data, review).save('schengen-cover-letter.pdf');
    else itineraryPdf(data, review).save('schengen-itinerary.pdf');
    $('payment-status').textContent = 'PDF generated. Review it for accuracy before using it.';
  } catch {
    $('payment-status').textContent = 'Could not generate the PDF. Please try again.';
  }
}

$('cover-download').addEventListener('click', () => downloadPdf('cover'));
$('itinerary-download').addEventListener('click', () => downloadPdf('itinerary'));
