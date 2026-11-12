import { ALLOWED_UNITS, ALLOWED_PICKUP_TIME_SLOTS, cleanText, toNumber } from './validate.js';
import { isValidDistrict } from '../constants/districts.js';
export function validQuantity(n, unit, zero = false) {
    return Number.isFinite(n) && (zero ? n >= 0 : n > 0) && n <= 1_000_000 &&
        (['DONA', 'BANKA', 'QUTI'].includes(unit) ? Number.isInteger(n) : Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-7);
}
export function fulfillmentFields(b) {
    const data = {};
    if (b.unit !== undefined) {
        if (!ALLOWED_UNITS.includes(b.unit))
            throw new Error('Birlik noto‘g‘ri');
        data.unit = b.unit;
    }
    for (const key of ['pickup_district', 'delivery_district', 'district'])
        if (b[key] !== undefined) {
            const d = cleanText(b[key], 120);
            if (d && !isValidDistrict(d))
                throw new Error('Tuman ro‘yxatda mavjud emas');
            data[key] = d || null;
        }
    if (b.pickup_address !== undefined)
        data.pickup_address = cleanText(b.pickup_address, 300) || null;
    if (b.pickup_window !== undefined) {
        const v = cleanText(b.pickup_window, 40);
        if (v && !ALLOWED_PICKUP_TIME_SLOTS.includes(v))
            throw new Error('Vaqt oralig‘i noto‘g‘ri');
        data.pickup_window = v || null;
    }
    for (const [key, max] of [['pickup_lat', 90], ['pickup_lng', 180], ['delivery_lat', 90], ['delivery_lng', 180]])
        if (b[key] !== undefined) {
            const n = b[key] === null || b[key] === '' ? null : toNumber(b[key]);
            if (n !== null && (!Number.isFinite(n) || Math.abs(n) > max))
                throw new Error('Koordinatalar noto‘g‘ri');
            data[key] = n;
        }
    for (const prefix of ['pickup', 'delivery'])
        if ((b[prefix + '_lat'] !== undefined || b[prefix + '_lng'] !== undefined) && ((data[prefix + '_lat'] == null) !== (data[prefix + '_lng'] == null)))
            throw new Error('Koordinatalar noto‘g‘ri');
    return data;
}
export const snapshotPickup = (p) => ({ unit: p.unit, pickup_district: p.pickup_district, pickup_address: p.pickup_address, pickup_lat: p.pickup_lat, pickup_lng: p.pickup_lng, pickup_window: p.pickup_window });
