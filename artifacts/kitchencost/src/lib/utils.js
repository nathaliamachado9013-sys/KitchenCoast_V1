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
