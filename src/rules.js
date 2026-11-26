import { countryName } from './countries.js';

export const SCHENGEN = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy',
  'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
  'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain',
  'Sweden', 'Switzerland',
];

const ec = 'https://home-affairs.ec.europa.eu/policies/schengen';
const india = 'https://www.schweiz-indien.eda.admin.ch/en/application-schengen-visa-procedure';
const code = (article) => ['Visa Code · Art. ' + article, 'https://eur-lex.europa.eu/eli/reg/2009/810/2024-06-28/eng#art_' + article];
export const SOURCES = {
  apply: ['European Commission application guide', ec + '/schengen-visas/applying-schengen-visa_en'],
  area: ['European Commission Schengen list', ec + '/schengen-area_en'],
  stay: ['EU short-stay calculator and guidance', ec + '/schengen-visas/short-stay-calculator_en'],
  fx: ['ECB euro reference rates', 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'],
  india: ['Official checklists for India (Swiss mission; example)', india],
};

export const DOCUMENTS = [
  ['form', 'Signed application form', 'Use the form and procedure listed by your mission.'],
  ['photos', 'Visa photos (typically 35 × 45 mm)', 'Confirm the number and current photo specifications.'],
  ['passportCopies', 'Passport copies and old passports', 'Check which pages and previous passports are requested.'],
  ['transport', 'Round-trip reservation and onward transport', 'Include bookings between destinations where requested.'],
  ['accommodation', 'Accommodation evidence', 'Collect bookings or the required private-host evidence.'],
  ['policy', 'Travel medical insurance certificate', 'Check the policy, not just the payment receipt.'],
  ['bank', 'Recent bank statements', 'Confirm the period and any certification or translation your visa office requires.'],
  ['tax', 'Income-tax returns (if requested)', 'Check the number of years and alternatives for your circumstances.'],
  ['leave', 'Leave approval, employer NOC, or equivalent (if applicable)', 'Students, retirees and self-employed applicants may need different evidence.'],
  ['letter', 'Signed cover letter / trip explanation', 'Confirm whether it is requested for your purpose and mission.'],
  ['invitation', 'Business or family invitation / host evidence', 'Check format, signatures, sponsor evidence and any originals required.', ['business', 'family']],
];

export function documentRequirements({ purpose, residenceCountry }) {
  return DOCUMENTS.filter((entry) => !entry[3] || entry[3].includes(purpose)).map(([key, label, detail]) => ({
    key, label, detail: key === 'tax' && residenceCountry === 'IN'
      ? 'Some checklists in India request income-tax returns (ITRs) for the last three years. Check your destination’s requirements.'
      : detail,
  }));
}

const DAY = 86_400_000;
export function dateDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null;
  const ts = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(ts) && new Date(ts).toISOString().slice(0, 10) === value ? ts / DAY : null;
}

export const isoDay = (day) => new Date(day * DAY).toISOString().slice(0, 10);
const clean = (value) => (value ?? '').trim();
const cityKey = (value) => clean(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ');
const numeric = (value) => clean(String(value ?? '')) === '' ? NaN : Number(value);
const usable = (row) => Object.values(row).some((value) => clean(String(value ?? '')) !== '');

export function shiftMonths(day, amount) {
  const result = new Date(day * DAY);
  const date = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + amount + 1, 0);
  result.setUTCDate(Math.min(date, result.getUTCDate()));
  return result.getTime() / DAY;
}

export function destination(segments, mainPurpose, firstEntry) {
  if (mainPurpose) {
    if (!SCHENGEN.includes(mainPurpose) || !segments.some((row) => row.country === mainPurpose)) {
      return { problem: 'The main-purpose country must be a Schengen destination listed in the itinerary.' };
    }
    return { country: mainPurpose, reason: 'This country is the main destination by purpose.' };
  }
  const stays = new Map();
  for (const { country, from, to } of segments) {
    const stay = stays.get(country) ?? { days: 0, through: from - 1 };
    stay.days += to - Math.max(from, stay.through + 1) + 1;
    stay.through = to;
    stays.set(country, stay);
  }
  if (stays.size === 1) {
    return { country: stays.keys().next().value, reason: 'It is the sole destination in your itinerary.' };
  }
  const longest = Math.max(...[...stays.values()].map(({ days }) => days));
  const leaders = [...stays].filter(([, { days }]) => days === longest);
  if (leaders.length === 1) {
    return { country: leaders[0][0], reason: `This country has the longest stay (${longest} days).` };
  }
  if (!firstEntry) return { problem: 'Enter your first external Schengen border crossing to resolve the tie.' };
  return { country: firstEntry, reason: 'No single main destination is indicated. When no main destination can be determined, apply to the country of first external Schengen entry.' };
}

export function peakRollingDays(prior, start, end) {
  const presence = new Set();
  for (const [from, through] of [...prior, [start, end]]) {
    for (let day = Math.max(from, start - 179); day <= Math.min(through, end); day += 1) {
      presence.add(day);
    }
  }
  let rolling = 0;
  let peak = 0;
  for (let day = start - 179; day <= end; day += 1) {
    if (presence.has(day)) rolling += 1;
    if (presence.has(day - 180)) rolling -= 1;
    if (day >= start) peak = Math.max(peak, rolling);
  }
  return peak;
}

export function audit(data, now = new Date().toISOString().slice(0, 10)) {
  const checks = [];
  const add = (status, title, reason, source) => checks.push({ status, title, reason, source });
  const start = dateDay(data.entry);
  const end = dateDay(data.exit);
  const validTrip = start !== null && end !== null && end >= start;
  const nights = validTrip ? end - start : null;
  const application = dateDay(data.application || now);
  const issue = dateDay(data.passportIssue);
  const expiry = dateDay(data.passportExpiry);
  const blank = numeric(data.blank);
  const psource = code(12);

  if (!validTrip) add('error', 'Trip dates', 'Enter valid entry and exit dates, with exit on or after entry.', SOURCES.apply);
  if ([data.name, data.passport].some((value) => !clean(value))) {
    add('warning', 'Applicant details', 'Add your name and passport number as shown on your travel document.', psource);
  }
  if (!data.passportCountry) {
    add('warning', 'Passport country', 'Select your passport’s issuing country. Visa requirements can depend on your nationality.', SOURCES.apply);
  }
  if (issue === null || expiry === null || !Number.isInteger(blank) || blank < 0 || !validTrip) {
    add('warning', 'Passport eligibility', 'Enter issue and expiry dates, number of blank pages and trip dates to complete this check.', psource);
  }
  let passportError = false;
  if (expiry !== null && validTrip && expiry < shiftMonths(end, 3)) {
    passportError = true;
    add('error', 'Passport expiry', `Your passport should be valid through at least ${isoDay(shiftMonths(end, 3))} (three calendar months after exit).`, psource);
  }
  if (issue !== null && (application !== null && issue > application ||
    validTrip && (issue <= shiftMonths(start, -120) || issue > start) || expiry !== null && issue >= expiry)) {
    passportError = true;
    add('error', 'Passport issue date', 'The passport must be issued by the filing date, be less than 10 years old on entry, and expire after its issue date.', psource);
  }
  if (Number.isInteger(blank) && blank >= 0 && blank < 2) {
    passportError = true;
    add('error', 'Blank passport pages', 'Leave at least two blank pages in your passport.', psource);
  }
  if (!passportError && validTrip && issue !== null && expiry !== null && Number.isInteger(blank) && blank >= 2) {
    add('ok', 'Passport eligibility', 'Your entered dates and blank pages meet the standard checks.', psource);
  }

  if (validTrip && application !== null) {
    const earliest = shiftMonths(start, -6);
    if (application < earliest) add('error', 'Application timing', `The standard filing window opens ${isoDay(earliest)} (six calendar months before entry).`, code(9));
    else if (application > start) add('error', 'Application timing', 'Your filing date is after your planned entry.', code(9));
    else if (start - application < 15) add('warning', 'Application timing', 'As a rule, file at least 15 calendar days before entry; exceptions are limited and processing can take longer.', code(9));
    else add('ok', 'Application timing', 'Filing is within six calendar months and at least 15 days before entry.', code(9));
  }

  if (validTrip) {
    const previous = (data.previous ?? []).filter(usable).map((row) => [dateDay(row.from), dateDay(row.to)]);
    const invalidHistory = previous.some(([from, to]) => from === null || to === null || from > to || to >= start);
    const count = nights >= 90 ? nights + 1 : peakRollingDays(previous.filter(([from, to]) => from !== null && to !== null && from <= to && to < start), start, end);
    if (count > 90) add('error', '90 days in any 180', `Your plan uses up to ${count} days including entry and exit, exceeding 90.`, SOURCES.stay);
    else if (!['none', 'yes'].includes(data.history) || (data.history === 'yes' && !previous.length) || invalidHistory || (data.history === 'none' && previous.length)) {
      add('warning', '90 days in any 180', `The planned trip is ${nights + 1} days. Confirm whether you had short stays in the previous 179 days, and enter each stay with dates before this trip.`, SOURCES.stay);
    } else add('ok', '90 days in any 180', `Maximum in any rolling 180-day window during this trip: ${count} days, based on your entries.`, SOURCES.stay);
  }

  const rows = (data.segments ?? []).filter(usable).map((row) => ({
    ...row, from: dateDay(row.from), to: dateDay(row.to), nights: numeric(row.nights),
  }));
  const unsupported = [...new Set([...rows.map((row) => row.country), data.firstEntry, data.consulate, data.mainPurpose].filter((country) => country && !SCHENGEN.includes(country)))];
  if (unsupported.length) add('error', 'Schengen destinations', unsupported.join(', ') + ' is not in the Schengen area. Check your visa and transit requirements separately.', SOURCES.area);
  const usableRows = rows.every((row) => SCHENGEN.includes(row.country) && cityKey(row.city) && row.from !== null && row.to !== null && row.to >= row.from && row.to - row.from === row.nights && (row.nights > 0 || row.to === end));
  const ordered = [...rows].sort((a, b) => a.from - b.from || a.to - b.to);
  const continuous = validTrip && rows.length > 0 && usableRows && ordered[0].from === start &&
    ordered.at(-1).to === end && ordered.every((row, i) => i === 0 || row.from === ordered[i - 1].to);
  if (!rows.length) add('error', 'Itinerary', 'Add at least one destination with dates, city and number of nights.', SOURCES.apply);
  else if (!continuous) add('error', 'Itinerary continuity', 'Every segment needs a Schengen country, a city and nights matching its dates. Start at entry, end at exit, and make each next segment start on the prior segment’s end date.', SOURCES.apply);
  else add('ok', 'Itinerary continuity', `The itinerary accounts for ${nights} ${nights === 1 ? 'night' : 'nights'} without gaps or overlaps.`, SOURCES.apply);

  let consulate = '';
  const firstEntry = SCHENGEN.includes(data.firstEntry) ? data.firstEntry : '';
  if (continuous) {
    const mainPurpose = data.mainPurpose;
    const result = destination(ordered, mainPurpose, firstEntry);
    if (result.problem) add('warning', 'Destination consulate', result.problem, code(5));
    else if (!mainPurpose && new Set(ordered.map((row) => row.country)).size > 1 && ['business', 'family'].includes(data.purpose)) {
      add('warning', 'Destination consulate', 'If business or visiting family is the main reason for the trip, identify where that activity takes place; purpose can take priority over length of stay.', code(5));
    } else {
      consulate = result.country;
      if (data.consulate && data.consulate !== consulate) add('error', 'Destination consulate', `Apply to ${consulate}, not ${data.consulate}. ${result.reason}`, code(5));
      else add(data.consulate ? 'ok' : 'warning', 'Destination consulate', `${data.consulate ? '' : 'Select your intended consulate to compare. '}Your itinerary points to ${consulate}. ${result.reason}`, code(5));
    }
  } else {
    add('warning', 'Destination consulate', 'Complete a continuous itinerary to determine the country responsible for your file.', code(5));
  }
  const residenceName = countryName(data.residenceCountry);
  const residence = [clean(data.city), clean(data.state), residenceName].filter(Boolean).join(', ');
  add('warning', 'Local filing jurisdiction', residenceName
    ? `Normally, apply where you legally reside. Confirm which ${consulate || 'destination-country'} mission or authorized visa centre serves ${residence}.`
    : 'Normally, apply where you legally reside. Confirm the correct filing office with your destination’s mission.', code(6));

  const hotels = (data.hotels ?? []).filter(usable).map((row) => ({ ...row, from: dateDay(row.from), to: dateDay(row.to) }));
  const incomplete = hotels.some((row) => !cityKey(row.city) || row.from === null || row.to === null || row.to <= row.from);
  if (incomplete) add('error', 'Incomplete accommodation', 'Add a city, check-in and a later checkout for every booking or host stay.', SOURCES.apply);
  if (validTrip && nights < 90) {
    const valid = hotels.filter((row) => cityKey(row.city) && row.from !== null && row.to !== null && row.to > row.from);
    const outside = valid.some((row) => row.from < start || row.to > end);
    const gaps = [];
    const overlaps = [];
    const mismatches = [];
    for (let day = start; day < end; day += 1) {
      const matching = valid.filter((row) => day >= row.from && day < row.to);
      const planned = continuous && ordered.find((row) => day >= row.from && day < row.to);
      if (matching.length === 0) gaps.push(day);
      if (matching.length > 1) overlaps.push(day);
      if (planned && matching.some((row) => cityKey(row.city) !== cityKey(planned.city))) mismatches.push(day);
    }
    const summarize = (days) => days.slice(0, 4).map(isoDay).join(', ') + (days.length > 4 ? ` and ${days.length - 4} more` : '');
    if (gaps.length) add('error', 'Accommodation gaps', `No booking or host stay for ${summarize(gaps)}. If you are travelling overnight, explain and document it.`, SOURCES.apply);
    if (overlaps.length) add('warning', 'Overlapping bookings', `More than one booking covers ${summarize(overlaps)}. Make clear which one you will use.`, SOURCES.apply);
    if (outside) add('warning', 'Accommodation outside trip', 'At least one booking starts before entry or ends after exit; verify the booking dates.', SOURCES.apply);
    if (mismatches.length) add('error', 'Accommodation city mismatch', `A booking city differs from the itinerary for ${summarize(mismatches)}. Check the cities or explain nearby accommodation.`, SOURCES.apply);
    if (!gaps.length && !overlaps.length && !outside && !mismatches.length && !incomplete) {
      add('ok', 'Accommodation dates', nights === 0 ? 'This same-day trip has no overnight stays.' : continuous
        ? 'One booking or host stay covers each night and the cities match.' : 'One booking or host stay covers each night. Fix the itinerary to compare cities.', SOURCES.apply);
    }
  }

  if (!data.outDate || !data.returnDate || !clean(data.outAirport) || !clean(data.returnAirport)) {
    add('warning', 'Travel reservations', 'Add the date and airport of first Schengen arrival and final Schengen departure.', SOURCES.apply);
  }
  if (validTrip) {
    const arrive = dateDay(data.outDate);
    const depart = dateDay(data.returnDate);
    if ((data.outDate && arrive !== start) || (data.returnDate && depart !== end)) {
      add('error', 'Flight date mismatch', 'Match the local dates of your first Schengen arrival and final departure, not the dates at your airport outside Schengen.', SOURCES.apply);
    } else if (arrive !== null && depart !== null && clean(data.outAirport) && clean(data.returnAirport)) {
      add('ok', 'Travel reservations', 'Entered arrival and departure dates match the trip.', SOURCES.apply);
    }
  }

  const ins = code(15);
  const amount = numeric(data.coverage);
  const fx = numeric(data.fx);
  const localCurrency = data.currency === 'LOCAL';
  const eur = localCurrency ? amount / fx : amount;
  if (!(amount > 0) || !Number.isFinite(amount)) add('error', 'Insurance amount', 'Enter the medical coverage amount, not the premium.', ins);
  else if (localCurrency && (!(fx > 0) || !Number.isFinite(fx))) add('warning', 'Insurance conversion', 'Enter the number of policy currency units per €1, or confirm the equivalent in euros with the insurer.', SOURCES.fx);
  else add(eur >= 30_000 ? 'ok' : 'error', 'Insurance amount', `${localCurrency ? 'Estimated at ' : 'Entered: '}€${eur.toLocaleString('en-IE', { maximumFractionDigits: 2 })}.${localCurrency ? ' Confirm the EUR equivalent on your certificate.' : ''} The minimum is €30,000 for emergency medical costs and repatriation.`, ins);
  const coverFrom = dateDay(data.insFrom);
  const coverTo = dateDay(data.insTo);
  if (coverFrom === null || coverTo === null || coverFrom > coverTo) add('error', 'Insurance dates', 'Enter valid policy start and end dates.', ins);
  else if (validTrip) {
    const covers = coverFrom <= start && coverTo >= end;
    add(covers ? 'ok' : 'error', 'Insurance dates', covers ? 'The policy covers entry through exit, inclusive.' : 'The policy must cover the full stay, including entry and exit days.', ins);
  }
  add(data.wide === 'yes' ? 'ok' : 'error', 'Insurance territory', data.wide === 'yes'
    ? 'You indicated coverage across all Schengen states. Verify the policy wording.'
    : 'Confirm the policy is valid in all Schengen states, not only those on the itinerary.', ins);

  if (!clean(data.employment) || !clean(data.funds)) {
    add('warning', 'Employment and funds', 'Add your work or study status and how the trip is financed. Proof and required amounts vary by country and situation.', SOURCES.apply);
  }
  if (!data.purpose || !data.priorVisa) {
    add('warning', 'Trip purpose and prior visas', 'Confirm your purpose and previous Schengen visas so you can review the right supporting documents.', SOURCES.apply);
  }
  const documents = documentRequirements(data).map((item) => ({ ...item, ready: Boolean(data.documents?.[item.key]) }));
  const missing = documents.filter((item) => !item.ready).length;
  add(missing ? 'warning' : 'ok', 'Document checklist', missing
    ? `${missing} items are unmarked. This is a starting point, not your mission’s final checklist.`
    : 'All suggested items are marked ready. Verify requirements for your country, purpose and status.', data.residenceCountry === 'IN' ? SOURCES.india : SOURCES.apply);
  return { checks, documents, consulate, ordered, nights, validTrip };
}
