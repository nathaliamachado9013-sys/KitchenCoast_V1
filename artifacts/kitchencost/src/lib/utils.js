import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Official base units accepted by the system (spec requirement)
export const ALLOWED_UNITS = ['g', 'ml', 'L', 'Kg', 'uni'];

// Legacy list kept for backward compatibility (dropdowns may still show these)
export const UNITS = ['Kg', 'g', 'L', 'ml', 'uni'];

/**
 * Normalize any input unit string to one of the official ALLOWED_UNITS.
 * Returns null if the unit cannot be mapped (caller should warn the user).
 *
 * Official units: g, ml, L, Kg, uni
 * Common aliases handled:
 *   mass   → g or Kg
 *   volume → ml or L
 *   count  → uni
 */
export const normalizeUnit = (raw) => {
  if (!raw) return null;
  const u = String(raw).trim().toLowerCase();

  // Already canonical (case-insensitive check)
  const canonical = ALLOWED_UNITS.find(a => a.toLowerCase() === u);
  if (canonical) return canonical;

  // Mass aliases → g or Kg
  if (['kg', 'kilo', 'kilos', 'quilograma', 'quilogramas', 'kgr'].includes(u)) return 'Kg';
  if (['g', 'gr', 'gram', 'grams', 'gramas', 'grama'].includes(u)) return 'g';

  // Volume aliases → L or ml
  if (['l', 'lt', 'ltr', 'litro', 'litros', 'litre', 'litres'].includes(u)) return 'L';
  if (['ml', 'mililitro', 'mililitros', 'milliliter', 'milliliters', 'mililiter'].includes(u)) return 'ml';

  // Count aliases → uni
  if ([
    'uni', 'un', 'unit', 'units', 'unidade', 'unidades', 'und', 'ud',
    'pc', 'pcs', 'peça', 'peças', 'item', 'items',
    'cx', 'caixa', 'caixas', 'box', 'boxes',
    'pkt', 'pk', 'pacote', 'pacotes', 'pack', 'packs',
    'saco', 'sacos', 'bag', 'bags',
    'garrafa', 'garrafas', 'bottle', 'bottles',
    'lata', 'latas', 'can', 'cans',
    'dz', 'dúzia', 'dúzias', 'dozen', 'dozens',
    'par', 'para', 'par',
  ].includes(u)) return 'uni';

  return null; // unknown — caller must decide
};

/**
 * KNOWN_MULTIPLIERS: units that always have a fixed per-unit count.
 * When the AI fails to convert these, we can do it client-side.
 */
const KNOWN_MULTIPLIERS = {
  'dúzia': 12, 'dúzias': 12, 'dz': 12, 'dozen': 12, 'dozens': 12,
  'par': 2, 'pares': 2, 'pair': 2, 'pairs': 2,
};

/**
 * VARIABLE_MULTIPLIER_UNITS: units whose per-unit size is unknown without context.
 * We cannot safely convert these without user input.
 */
const VARIABLE_MULTIPLIER_UNITS = new Set([
  'cx', 'caixa', 'caixas', 'box', 'boxes',
  'pkt', 'pk', 'pacote', 'pacotes', 'pack', 'packs',
  'saco', 'sacos', 'bag', 'bags',
]);

/**
 * parseSafeNumber — safely parse any quantity that may arrive as:
 *   - a JS number: 0.5, 12, 500
 *   - a numeric string: "12", "0.5"
 *   - comma decimal (BR/EU): "0,5" → 0.5
 *   - fraction string: "1/2" or "1 / 2" → 0.5
 *   - unicode vulgar fraction: "½", "¼", "¾" → 0.5, 0.25, 0.75
 *   - tilde/approx prefix: "~500", "aprox. 500" → 500
 *   - null / undefined / anything else → 0 (never NaN or undefined)
 *
 * UNICODE_FRACTIONS: maps Unicode vulgar fraction characters to their decimal value.
 * These appear in handwritten or OCR-scanned invoices.
 */
const UNICODE_FRACTIONS = {
  '½': 0.5, '⅓': 0.3333, '⅔': 0.6667, '¼': 0.25, '¾': 0.75,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
};

export const parseSafeNumber = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let str = String(v).trim();

  // Strip non-numeric prefixes: "~500", "aprox. 500", "≈500", "< 500"
  // Only strip leading symbols, not digits or decimal indicators
  str = str.replace(/^[~≈<>≤≥aprox.\s]+/i, '').trim();

  // Unicode vulgar fractions: "½", "¼", "¾" — check full string or leading char
  for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (str === char) return val;
    // Mixed number: "1½" → 1 + 0.5 = 1.5
    if (str.endsWith(char)) {
      const whole = parseFloat(str.slice(0, -char.length));
      if (!isNaN(whole)) return whole + val;
    }
  }

  // IMPORTANT: check for fraction BEFORE parseFloat.
  // parseFloat("1/2") returns 1 (reads "1", stops at "/") — not NaN.
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0].trim());
      const den = parseFloat(parts[1].trim());
      if (!isNaN(num) && !isNaN(den) && den !== 0) return Math.round((num / den) * 10000) / 10000;
    }
    return 0; // malformed fraction
  }

  // Comma decimal: "0,5" → "0.5" (common in Brazilian/European invoices)
  // Only if the string has exactly one comma and it looks like a decimal separator
  // (i.e., not a thousands separator like "1.000,5")
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else if (str.includes(',') && str.includes('.')) {
    // Thousands separator style: "1.000,50" → remove dots, replace comma
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};

/**
 * UNIT_SCALE_CONVERSIONS: units with a known multiplicative factor to a base unit.
 * These are NOT pack/count multipliers — they are metric sub-units.
 * e.g. cl (centiliter) → ml: factor = 10 (1 cl = 10 ml)
 */
const UNIT_SCALE_CONVERSIONS = {
  // Volume sub-units
  'cl': { factor: 10, targetUnit: 'ml' },   // centiliter → milliliter
  'dl': { factor: 100, targetUnit: 'ml' },  // deciliter  → milliliter
  // Mass sub-units (rare on invoices but valid)
  'mg': { factor: 0.001, targetUnit: 'g' }, // milligram  → gram
};

/**
 * applyUnitConversion — client-side safety net for unit conversion.
 *
 * Given raw quantity + raw unit from the AI, returns a fully resolved
 * { quantity, unit, needsConversion, conversionNote }.
 *
 * Decision tree:
 *  1. Parse quantity safely (handles fractions like "1/2").
 *  2. Already a base unit (g, ml, L, Kg, uni) → return as-is.
 *  3. Metric sub-unit with known scale factor (cl, dl, mg) → multiply.
 *  4. Fixed count multiplier (dúzia×12, par×2) → multiply, unit=uni.
 *  5. Variable multiplier unit (cx, pacote, saco, pack) → flag for user.
 *     Unit left as null so the user MUST select target unit + enter qty.
 *  6. Generic alias → normalizeUnit(); flag if unknown.
 */
export const applyUnitConversion = (rawQuantity, rawUnit) => {
  // Bug-fix 1: never use parseFloat directly — fractions like "1/2" become NaN
  const qty = parseSafeNumber(rawQuantity);

  if (!rawUnit) {
    return { quantity: qty, unit: 'uni', needsConversion: false, conversionNote: null };
  }

  const u = String(rawUnit).trim().toLowerCase();

  // Step 2: already a canonical base unit
  if (ALLOWED_UNITS.some(a => a.toLowerCase() === u)) {
    return {
      quantity: qty,
      unit: ALLOWED_UNITS.find(a => a.toLowerCase() === u),
      needsConversion: false,
      conversionNote: null,
    };
  }

  // Bug-fix 2: metric sub-units (cl → ml ×10, dl → ml ×100, mg → g ×0.001)
  const scale = UNIT_SCALE_CONVERSIONS[u];
  if (scale) {
    const converted = Math.round(qty * scale.factor * 10000) / 10000;
    return {
      quantity: converted,
      unit: scale.targetUnit,
      needsConversion: false,
      conversionNote: `${qty} ${rawUnit} × ${scale.factor} = ${converted} ${scale.targetUnit}`,
    };
  }

  // Step 4: fixed count multipliers (dúzia, par, dozen)
  const fixedMultiplier = KNOWN_MULTIPLIERS[u];
  if (fixedMultiplier) {
    const converted = Math.round(qty * fixedMultiplier * 10000) / 10000;
    return {
      quantity: converted,
      unit: 'uni',
      needsConversion: false,
      conversionNote: `${qty} ${rawUnit} × ${fixedMultiplier} = ${converted} uni`,
    };
  }

  // Bug-fix 3: variable multiplier units — do NOT default unit to 'uni'.
  // Leave unit as null so the review UI forces the user to pick the correct
  // target unit (could be Kg, L, uni, etc.) before entering the multiplier.
  if (VARIABLE_MULTIPLIER_UNITS.has(u)) {
    return {
      quantity: qty,
      unit: null, // user must select target unit
      needsConversion: true,
      conversionNote: `Unidade "${rawUnit}" é uma embalagem — selecione a unidade final (Kg, L, uni…) e informe a quantidade por embalagem`,
    };
  }

  // Step 6: generic alias normalization
  const normalized = normalizeUnit(rawUnit);
  return {
    quantity: qty,
    unit: normalized || null,
    needsConversion: !normalized,
    conversionNote: normalized ? null : `Unidade "${rawUnit}" não reconhecida — selecione a unidade correta`,
  };
};

export const INGREDIENT_CATEGORIES = [
  'Carnes', 'Vegetais', 'Frutas', 'Laticínios', 'Grãos', 'Temperos', 'Bebidas', 'Outros'
];

export const RECIPE_CATEGORIES = [
  'Entrada', 'Prato Principal', 'Sobremesa', 'Bebida', 'Pizza', 'Massa', 'Acompanhamento', 'Outros'
];

export const SALES_CHANNELS = [
  'Balcão', 'Delivery', 'iFood', 'Rappi', 'Uber Eats', 'WhatsApp', 'Telefone', 'Outro'
];

export const SUPPORTED_CURRENCIES = ['BRL', 'EUR', 'USD', 'GBP'];

const CURRENCY_CONFIG = {
  EUR: { symbol: '€', locale: 'de-DE', code: 'EUR' },
  USD: { symbol: '$', locale: 'en-US', code: 'USD' },
  BRL: { symbol: 'R$', locale: 'pt-BR', code: 'BRL' },
  GBP: { symbol: '£', locale: 'en-GB', code: 'GBP' },
};

export const formatCurrency = (value, currency = 'BRL') => {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.BRL;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
  }).format(value || 0);
};

export const getCurrencySymbol = (currency = 'BRL') => {
  return CURRENCY_CONFIG[currency]?.symbol || 'R$';
};

export const formatNumber = (value, decimals = 2) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0);
};

export const formatDate = (date) => {
  if (!date) return '-';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR');
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString('pt-BR');
};

export const UNIT_CONVERSIONS = {
  // Mass — base unit: g
  g: 1.0,
  kg: 1000.0,
  Kg: 1000.0,
  // Volume — base unit: ml
  ml: 1.0,
  l: 1000.0,
  L: 1000.0,
  // Count — base unit: uni
  uni: 1.0,
  unit: 1.0,
  un: 1.0,
  unidade: 1.0,
  package: 1.0,
  pacote: 1.0,
  box: 1.0,
  caixa: 1.0,
  'dúzia': 12.0,
};

export const UNIT_GROUPS = {
  mass: ['g', 'kg', 'Kg'],
  volume: ['ml', 'l', 'L'],
  count: ['uni', 'unit', 'un', 'unidade', 'package', 'pacote', 'box', 'caixa', 'dúzia'],
};

export const canConvert = (fromUnit, toUnit) => {
  if (fromUnit === toUnit) return true;
  for (const group of Object.values(UNIT_GROUPS)) {
    if (group.includes(fromUnit) && group.includes(toUnit)) return true;
  }
  return false;
};

export const convertUnits = (quantity, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return quantity;
  const from = UNIT_CONVERSIONS[fromUnit] || 1;
  const to = UNIT_CONVERSIONS[toUnit] || 1;
  return (quantity * from) / to;
};

export const MARGIN_RECOMMENDATIONS = {
  Bebida: { min: 0.80, max: 0.90, label: '80% - 90%' },
  Pizza: { min: 0.65, max: 0.75, label: '65% - 75%' },
  Massa: { min: 0.60, max: 0.70, label: '60% - 70%' },
  Sobremesa: { min: 0.70, max: 0.80, label: '70% - 80%' },
  Entrada: { min: 0.65, max: 0.75, label: '65% - 75%' },
  'Prato Principal': { min: 0.60, max: 0.70, label: '60% - 70%' },
  Acompanhamento: { min: 0.55, max: 0.65, label: '55% - 65%' },
  Outros: { min: 0.50, max: 0.70, label: '50% - 70%' },
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};
