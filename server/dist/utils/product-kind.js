// Match a commodity, not its whole category. Unknown names only match identical names.
const commodities = [
    ['olma', 'олма', 'apple', 'яблоко', 'яблоки'],
    ['uzum', 'узум', 'grape', 'виноград'],
    ['nok', 'нок', 'pear', 'груша'],
    ['shaftoli', 'шафтоли', 'peach', 'персик'],
    ['orik', 'ўрик', 'урик', 'apricot', 'абрикос'],
    ['olcha', 'олча', 'вишня'],
    ['gilos', 'гилос', 'cherry', 'черешня'],
    ['anor', 'анор', 'pomegranate', 'гранат'],
    ['limon', 'лимон', 'lemon'],
    ['banan', 'банан', 'banana'],
    ['qulupnay', 'қулупнай', 'клубника', 'strawberry'],
    ['pomidor', 'помидор', 'tomato', 'помидоры'],
    ['bodring', 'бодринг', 'cucumber', 'огурец'],
    ['kartoshka', 'картошка', 'potato', 'картофель'],
    ['piyoz', 'пиёз', 'пиeз', 'onion', 'лук'],
    ['sabzi', 'сабзи', 'carrot', 'морковь'],
    ['karam', 'карам', 'cabbage', 'капуста'],
    ['qalampir', 'қалампир', 'pepper', 'перец'],
    ['baqlajon', 'бақлажон', 'баклажан'],
    ['tarvuz', 'тарвуз', 'watermelon', 'арбуз'],
    ['qovun', 'қовун', 'melon', 'дыня'],
    ['qovoq', 'қовоқ', 'pumpkin', 'тыква'],
    ['sut', 'сут', 'milk', 'молоко'],
    ['guruch', 'гуруч', 'rice', 'рис'],
    ['bugdoy', 'буғдой', 'wheat', 'пшеница'],
    ['arpa', 'арпа', 'barley', 'ячмень'],
];
export function normalizeProductName(value) {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/['’‘ʻʼ`]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}
export function productKind(title) {
    const normalized = normalizeProductName(title);
    const words = new Set(normalized.split(' '));
    const suffixes = [
        '',
        'lar',
        'lari',
        'i',
        'si',
        'ning',
        's',
        'лар',
        'лари',
        'и',
        'си',
    ];
    const matches = commodities.filter((aliases) => aliases.some((alias) => suffixes.some((suffix) => words.has(alias + suffix))));
    if (matches.length !== 1)
        return `exact:${normalized}`;
    const modifiers = [
        'quritilgan',
        'qoqi',
        'sharbat',
        'murabbo',
        'pyure',
        'сушеный',
        'сок',
    ]
        .filter((w) => suffixes.some((suffix) => words.has(w + suffix)))
        .sort();
    return `${matches[0][0]}${modifiers.length ? ':' + modifiers.join(':') : ''}`;
}
