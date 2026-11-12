// Toshkent shahri va viloyati tumanlari
// Client va server bir xil ro'yxat ishlatadi
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
];
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
];
// Birlashtirilgan ro'yxat — select/dropdown'larda ishlatiladi
export const ALL_DISTRICTS = [
    ...TASHKENT_CITY_DISTRICTS,
    ...TASHKENT_REGION_DISTRICTS,
];
// Validatsiya uchun yordamchi
export function isValidDistrict(value) {
    return ALL_DISTRICTS.includes(value);
}
