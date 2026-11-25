import { jsPDF } from 'jspdf';
import { dateDay, isoDay } from './rules.js';

const disclaimer = 'Not legal or visa advice; not affiliated with any embassy, VFS or the EU.';
const purposeLabel = { tourism: 'tourism', business: 'business', family: 'a family visit' };

function latin(value) {
  return String(value ?? '').trim().normalize('NFKD').replace(/\p{Mark}/gu, '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/gu, '?');
}

function writer(title) {
  const doc = new jsPDF({ compress: true });
  let y;
  const header = () => {
    doc.setFillColor(21, 57, 53);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(255);
    doc.text(title, 18, 18);
    doc.setTextColor(22, 42, 38);
    y = 42;
  };
  header();
  return {
    line(text, bold = false) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(11);
      for (const line of doc.splitTextToSize(latin(text), 174)) {
        if (y > 268) {
          doc.addPage();
          header();
          doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(11);
        }
        doc.text(line, 18, y);
        y += 5.5;
      }
    },
    space() { y += 4; },
    finish() {
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page).setFont('helvetica', 'normal').setFontSize(8).setTextColor(69, 92, 83);
        doc.text(disclaimer, 18, 283);
        doc.text(`${page} / ${pages}`, 192, 283, { align: 'right' });
      }
      return doc;
    },
  };
}

export function coverLetter(data, review) {
  const pdf = writer('Schengen visa cover letter');
  pdf.line('To the Visa Officer', true);
  pdf.line(`Consular Section - ${review.consulate}`);
  pdf.line('India');
  pdf.space();
  pdf.line(`Subject: Short-stay visa application | ${data.entry} to ${data.exit}`, true);
  pdf.space();
  pdf.line('Dear Visa Officer,');
  pdf.space();
  pdf.line(`I am ${data.name.trim()}, holder of Indian passport ${data.passport.trim()}. I am applying for a short-stay Schengen visa for ${purposeLabel[data.purpose]}. I plan to enter on ${data.entry} and leave on ${data.exit}.`);
  pdf.space();
  pdf.line('Planned route:', true);
  review.ordered.forEach((stop) => pdf.line(`${stop.city}, ${stop.country} | ${isoDay(stop.from)} to ${isoDay(stop.to)}`));
  pdf.space();
  if (data.employment?.trim()) pdf.line(`Employment / studies: ${data.employment.trim()}`);
  if (data.funds?.trim()) pdf.line(`Trip funding: ${data.funds.trim()}`);
  const residence = [data.city, data.state].map((item) => item?.trim()).filter(Boolean);
  if (residence.length) pdf.line(`Current residence: ${residence.join(', ')}, India`);
  pdf.space();
  pdf.line('Thank you for considering my application.');
  pdf.space();
  pdf.line('Yours faithfully,');
  pdf.line(data.name);
  pdf.space();
  pdf.line('Signature: ____________________   Date: ____________________');
  return pdf.finish();
}

export function itineraryPdf(data, review) {
  const pdf = writer('Day-by-day Schengen itinerary');
  pdf.line(`${data.name.trim()} | ${data.entry} to ${data.exit}`, true);
  pdf.space();
  const start = dateDay(data.entry);
  const end = dateDay(data.exit);
  const hotelDates = (data.hotels ?? []).filter((row) => row.city?.trim()).map((row) => ({
    city: row.city.trim(), from: dateDay(row.from), to: dateDay(row.to),
  })).filter((row) => row.from !== null && row.to !== null && row.from < row.to);
  for (let day = start; day <= end; day += 1) {
    const stop = day === end ? review.ordered.at(-1) : review.ordered.find((row) => day >= row.from && day < row.to);
    const old = day > start ? review.ordered.find((row) => day - 1 >= row.from && day - 1 < row.to) : null;
    const changesCity = old && (old.city !== stop.city || old.country !== stop.country);
    pdf.line(`Day ${day - start + 1} | ${isoDay(day)} | ${stop.city}, ${stop.country}`, true);
    if (day === start) pdf.line('Schengen arrival' + (data.outAirport?.trim() ? ' at ' + data.outAirport.trim() : ''));
    if (changesCity) pdf.line(`Onward travel from ${old.city} to ${stop.city}`);
    if (day === end) pdf.line('Schengen departure' + (data.returnAirport?.trim() ? ' from ' + data.returnAirport.trim() : ''));
    else {
      const cities = [...new Set(hotelDates.filter((row) => day >= row.from && day < row.to).map((row) => row.city))];
      pdf.line(cities.length ? 'Overnight booking locations: ' + cities.join(', ') : 'Overnight location not recorded');
    }
    pdf.space();
  }
  return pdf.finish();
}
