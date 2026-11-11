// Toshkent shahri va viloyati tumanlari
// Server va client bir xil ro'yxat ishlatadi
export const TASHKENT_CITY_DISTRICTS = [
  'Bektemir',
  'Chilonzor',
  'Mirobod',
  'Mirzo Ulug\'bek',
  'Olmazor',
  'Sergeli',
  'Shayxontohur',
  'Uchtepa',
  'Yakkasaroy',
  'Yashnobod',
  'Yunusobod',
  'Yangihayot',
] as const;

export const TASHKENT_REGION_DISTRICTS = [
  'Parkent',
  'Zangiota',
  'Qibray',
  'Bo\'stonliq',
  'Piskent',
  'Ohangaron',
  'Yangiyo\'l',
  'Chirchiq',
  'Angren',
  'Olmaliq',
  'Bekobod',
  'Nurafshon',
  'Bo\'ka',
  'Chinoz',
  'Quyi Chirchiq',
  'O\'rta Chirchiq',
  'Oqqo\'rg\'on',
  'Toshkent tumani',
  'Yuqori Chirchiq',
] as const;

// Birlashtirilgan ro'yxat — select/dropdown'larda ishlatiladi
export const ALL_DISTRICTS = [
  ...TASHKENT_CITY_DISTRICTS,
  ...TASHKENT_REGION_DISTRICTS,
] as const;

export type District = typeof ALL_DISTRICTS[number];

// Validatsiya uchun yordamchi
export function isValidDistrict(value: string): value is District {
  return (ALL_DISTRICTS as readonly string[]).includes(value);
}
