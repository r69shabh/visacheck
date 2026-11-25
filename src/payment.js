import { GUMROAD_PRODUCT_ID } from './config.js';

export async function verifyLicense(key, request = fetch) {
  const response = await request('https://api.gumroad.com/v2/licenses/verify', {
    method: 'POST',
    body: new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: key,
      increment_uses_count: 'false',
    }),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error('License verification unavailable');
  const { success, purchase } = await response.json();
  return success === true && purchase?.product_id === GUMROAD_PRODUCT_ID &&
    !purchase.refunded && !purchase.chargebacked && (!purchase.disputed || purchase.dispute_won === true);
}
