const ruleFaq = [
  ['Do entry and exit days count?', 'Yes. The day you enter and the day you leave both count as days in Schengen. If you enter and leave on the same date, count that date once.'],
  ['Does leaving Schengen reset the 90 days?', 'No. Days outside Schengen do not count as days of presence, but previous visits still count until their dates fall outside the rolling 180-day window.'],
  ['Does the limit apply separately to each country?', 'No. Short stays in Schengen countries share one limit. A day spent traveling between two Schengen countries still counts as one day.'],
];

export const pages = {
  'index.html': {
    title: 'Free Schengen Visa Checklist & File Checker | VisaCheck',
    description: 'Check your Schengen visa documents, bookings, insurance and travel dates before applying. Free checklist and 90/180-day check in your browser.',
  },
  'terms.html': {
    title: 'Terms & Privacy | VisaCheck',
    description: 'Learn how VisaCheck stores trip details in your browser and handles PDF pack purchases and license verification.',
  },
  'schengen-90-180-rule.html': {
    label: 'Schengen 90/180 rule',
    title: 'Schengen 90/180 Rule Explained with Examples | VisaCheck',
    description: 'Understand the rolling Schengen 90/180 rule, which days count, and why leaving does not reset the clock. Follow two worked examples.',
  },
  'schengen-days-calculator.html': {
    label: 'Calculate Schengen days',
    title: 'Schengen 90/180-Day Calculator Guide | VisaCheck',
    description: 'Use the official Schengen calculator or check your planned trip in VisaCheck. Learn which dates to enter and what to do if a trip may overstay.',
  },
  'schengen-countries.html': {
    label: 'Schengen countries',
    title: 'Schengen Countries List: All 29 Members | VisaCheck',
    description: 'See all 29 Schengen countries, including Bulgaria and Romania, and learn how Schengen differs from the EU when counting travel days.',
  },
  'etias-ees.html': {
    label: 'ETIAS and EES',
    title: 'ETIAS vs EES: What Schengen Travelers Need to Know | VisaCheck',
    description: 'Learn how the EU Entry/Exit System differs from ETIAS, who each applies to, and where to check the official rollout before traveling.',
  },
};

const guides = Object.entries(pages).filter(([, page]) => page.label);
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pathFor = (file) => file === 'index.html' ? '/' : '/' + file;
const guidesNav = '<nav class="guide-links" aria-label="Travel guides">' +
  guides.map(([file, page]) => `<a href="/${file}">${escapeHtml(page.label)}</a>`).join('\n') +
  '</nav>';

function structuredData(file, page, url, home) {
  const context = { '@context': 'https://schema.org' };
  if (file === 'index.html') {
    return [{
      ...context,
      '@type': 'WebApplication',
      name: 'VisaCheck',
      url,
      description: page.description,
      applicationCategory: 'TravelApplication',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', name: 'Free visa file checker' },
    }];
  }
  if (!page.label) return [];
  const data = [{
    ...context,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VisaCheck', item: home },
      { '@type': 'ListItem', position: 2, name: page.label, item: url },
    ],
  }];
  if (file === 'schengen-90-180-rule.html') {
    data.push({
      ...context,
      '@type': 'FAQPage',
      mainEntity: ruleFaq.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }
  return data;
}

export function seo(env) {
  const site = new URL(env.SITE_URL || 'https://visacheck-isxx.onrender.com');
  if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
    throw new Error('SITE_URL must be an HTTPS origin without a path, query or fragment.');
  }
  const sitemap = site.origin + '/sitemap.xml';
  const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  return {
    name: 'visacheck-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, { filename }) {
        const file = filename.split(/[/\\]/).pop();
        const page = pages[file];
        if (!page) return html;
        const { title, description } = page;
        const url = site.origin + pathFor(file);
        const head = [
          `<title>${escapeHtml(title)}</title>`,
          meta('name', 'description', description),
          `<link rel="canonical" href="${escapeHtml(url)}">`,
          meta('property', 'og:type', page.label ? 'article' : 'website'),
          meta('property', 'og:site_name', 'VisaCheck'),
          meta('property', 'og:title', title),
          meta('property', 'og:description', description),
          meta('property', 'og:url', url),
          meta('name', 'twitter:card', 'summary'),
          meta('name', 'twitter:title', title),
          meta('name', 'twitter:description', description),
        ];
        if (file === 'index.html') {
          if (env.GOOGLE_SITE_VERIFICATION?.trim()) head.push(meta('name', 'google-site-verification', env.GOOGLE_SITE_VERIFICATION.trim()));
          if (env.BING_SITE_VERIFICATION?.trim()) head.push(meta('name', 'msvalidate.01', env.BING_SITE_VERIFICATION.trim()));
        }
        for (const data of structuredData(file, page, url, site.href)) {
          head.push(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
        }
        return html.replace('<!-- seo -->', () => head.join('\n  '))
          .replaceAll('<!-- guides -->', () => guidesNav)
          .replace('<!-- faq -->', () => ruleFaq.map(([question, answer]) =>
            `<h3>${escapeHtml(question)}</h3>\n<p>${escapeHtml(answer)}</p>`).join('\n'));
      },
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          Object.keys(pages).map((file) => `  <url><loc>${escapeHtml(site.origin + pathFor(file))}</loc></url>\n`).join('') +
          '</urlset>\n',
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`,
      });
    },
  };
}
