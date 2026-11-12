import test from 'node:test';
import assert from 'node:assert/strict';
import { positiveInt, positiveNumber, toNumber } from '../src/utils/validate.js';

test('numeric inputs reject junk, coercions, fractions for money and database overflow', () => {
  for (const input of ['12kg', '1.5foo', '', ' ', [], {}, true, null, Infinity, NaN]) {
    assert.ok(Number.isNaN(toNumber(input)), String(input));
    assert.equal(positiveNumber(input), null);
    assert.equal(positiveInt(input), null);
  }
  for (const input of [0, -1, 0.1, 1.5, 2_147_483_648]) assert.equal(positiveInt(input), null);
  assert.equal(positiveInt('15000'), 15000);
  assert.equal(positiveNumber('0.25'), 0.25);
});

test('commodity matching supports Uzbek suffixes without mixing processing or ambiguous products', async () => {
  const { productKind } = await import('../src/utils/product-kind.js');
  assert.equal(productKind('Parkent uzumi'),productKind('Uzum'));
  assert.equal(productKind('Qizil olmalar'),productKind('Olma'));
  assert.notEqual(productKind('Olma'),productKind('Uzum'));
  assert.notEqual(productKind('Quritilgan olma'),productKind('Olma'));
  assert.notEqual(productKind('Olma sharbati'),productKind('Olma'));
  assert.notEqual(productKind('Olma va uzum'),productKind('Olma'));
});

test('missing identity documents are displayed safely while existing values stay masked',async()=>{
  const {maskId}=await import('../src/utils/validate.js');
  assert.equal(maskId(null),'Ko‘rsatilmagan');assert.equal(maskId(undefined),'Ko‘rsatilmagan');
  assert.equal(maskId(''),'Ko‘rsatilmagan');assert.equal(maskId('  '),'Ko‘rsatilmagan');
  assert.equal(maskId('AA1234567'),'AA***4567');assert.equal(maskId('123'),'****');
});
