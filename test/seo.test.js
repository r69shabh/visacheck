import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'vite';
import { seo } from '../seo.js';

const origin = 'https://visacheck-isxx.onrender.com';
const guides = [
  '/schengen-90-180-rule.html',
  '/schengen-days-calculator.html',
  '/schengen-countries.html',
  '/etias-ees.html',
];

async function builtAssets() {
  const result = await build({ logLevel: 'silent', build: { write: false } });
  return new Map(result.output.filter(({ type }) => type === 'asset').map(({ fileName, source }) => [fileName, source.toString()]));
}

test('production SEO is present in static pages and discovery files', async () => {
  const assets = await builtAssets();
  const paths = ['/', '/terms.html', ...guides];
  const titles = new Set();
  const descriptions = new Set();
  const schema = new Map();
  for (const path of paths) {
    const html = assets.get(path === '/' ? 'index.html' : path.slice(1));
    assert.ok(html, path);
    assert.match(html, /<html lang="en">/);
    assert.doesNotMatch(html, /<!-- (?:seo|guides|faq) -->/);
    assert.ok(html.includes(`<link rel="canonical" href="${origin}${path}">`), path);
    assert.ok(html.includes(`<meta property="og:url" content="${origin}${path}">`), path);
    assert.match(html, /<meta name="twitter:card" content="summary">/);
    titles.add(html.match(/<title>([^<]+)<\/title>/)[1]);
    descriptions.add(html.match(/<meta name="description" content="([^"]+)">/)[1]);
    schema.set(path, [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(([, body]) => JSON.parse(body)));
  }
  assert.equal(titles.size, paths.length);
  assert.equal(descriptions.size, paths.length);
  const sitemap = assets.get('sitemap.xml');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url).sort(), paths.map((path) => origin + path).sort());
  assert.equal(assets.get('robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  const home = assets.get('index.html');
  assert.doesNotMatch(home, /google-site-verification|msvalidate\.01/);
  assert.equal(schema.get('/')[0]['@type'], 'WebApplication');
  const faq = schema.get(guides[0]).find((item) => item['@type'] === 'FAQPage');
  for (const question of faq.mainEntity) {
    const guide = assets.get(guides[0].slice(1));
    assert.ok(guide.includes(`<h3>${question.name}</h3>`));
    assert.ok(guide.includes(`<p>${question.acceptedAnswer.text}</p>`));
  }
  for (const path of guides) {
    assert.ok(home.split('<footer>')[0].includes(`href="${path}"`));
    assert.ok(home.split('<footer>')[1].includes(`href="${path}"`));
    const breadcrumb = schema.get(path)[0];
    assert.equal(breadcrumb['@type'], 'BreadcrumbList');
    assert.deepEqual(breadcrumb.itemListElement.map(({ item }) => item), [origin + '/', origin + path]);
  }
});

test('configured verification tags and canonical origin are safely rendered', () => {
  const plugin = seo({
    SITE_URL: 'https://visa.example/',
    GOOGLE_SITE_VERIFICATION: ' google&token ',
    BING_SITE_VERIFICATION: 'bing"token',
  });
  const render = (filename) => plugin.transformIndexHtml.handler('<!-- seo -->', { filename });
  const home = render('/site/index.html');
  assert.match(home, /<link rel="canonical" href="https:\/\/visa\.example\/">/);
  assert.match(home, /<meta name="google-site-verification" content="google&amp;token">/);
  assert.match(home, /<meta name="msvalidate\.01" content="bing&quot;token">/);
  assert.doesNotMatch(render('/site/terms.html'), /google-site-verification|msvalidate\.01/);
});
