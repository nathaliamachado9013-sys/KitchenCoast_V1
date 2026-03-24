import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from './firebase';

// To change the prompt template, edit EXTRACTION_PROMPT below.
// Template ID for future server-side migration:
export const EXTRACTION_TEMPLATE_ID = 'invoice-extraction-v2';

const EXTRACTION_PROMPT = `You are an expert at extracting structured data from purchase invoices.
Analyze this invoice image or PDF and extract all information listed below.
Return ONLY a valid JSON object matching the schema. Do NOT add markdown formatting or extra text.
If you cannot confidently extract a field, use null — do NOT invent data.

CRITICAL UNIT CONVERSION RULES:
You MUST convert all quantities to one of these official base units: g, ml, L, Kg, uni
You must NEVER return pack, box, caixa, pacote, saco, garrafa, dúzia, dz, cx, etc. as the final unit.

Conversion rules:
- dúzia / dz / dozen → multiply quantity by 12, unit = "uni"
- par / pares / pair → multiply quantity by 2, unit = "uni"
- cx / caixa / box + known size → multiply, set base unit (Kg, L, uni, etc.)
- saco / bag / pacote / pack + known size → multiply, set base unit
- garrafa / bottle / lata / can → unit = "uni" (each container = 1 uni, unless liquid volume stated)
- kg / kilo / quilograma → unit = "Kg"
- g / gr / grama → unit = "g"
- l / lt / litro → unit = "L"
- ml / mililitro → unit = "ml"
- cl / centilitro → multiply by 10, unit = "ml" (1 cl = 10 ml)
- dl / decilitro → multiply by 100, unit = "ml" (1 dl = 100 ml)
- un / und / unidade / unit / pc / pcs → unit = "uni"
- Fraction quantities: "1/2" → 0.5, "3/4" → 0.75. ALWAYS return quantity as a decimal number.
- "NxYunit" format: "12x33cl" → 12 units × 33 cl each = 396 cl = 3960 ml → quantity: 3960, unit: "ml"
- "N × Y unit" format: "4 × 30g" → quantity: 120, unit: "g"

Examples of correct conversion:
  "15 dúzias ovos"      → quantity: 180,  unit: "uni", conversion_note: "15 dz × 12 = 180 uni"
  "2 packs 12 pães"     → quantity: 24,   unit: "uni", conversion_note: "2 packs × 12 = 24 uni"
  "3 sacos 2.5 Kg"      → quantity: 7.5,  unit: "Kg",  conversion_note: "3 × 2.5 Kg = 7.5 Kg"
  "4 emb. 30g salsa"    → quantity: 120,  unit: "g",   conversion_note: "4 × 30 g = 120 g"
  "2 cx 5L maionese"    → quantity: 10,   unit: "L",   conversion_note: "2 × 5 L = 10 L"
  "12x33cl refrigerante"→ quantity: 3960, unit: "ml",  conversion_note: "12 × 33 cl × 10 = 3960 ml"
  "pack 6x1L azeite"    → quantity: 6,    unit: "L",   conversion_note: "6 × 1 L = 6 L"
  "cx 2kg farinha"      → quantity: 2,    unit: "Kg",  conversion_note: "1 cx × 2 Kg = 2 Kg"
  "1/2 kg tomate"       → quantity: 0.5,  unit: "Kg",  conversion_note: null
  "aprox. 500g carne"   → quantity: 500,  unit: "g",   conversion_note: null
  "24 garrafas Coca"    → quantity: 24,   unit: "uni", conversion_note: "24 uni"

If you CANNOT determine the multiplier (e.g., "3 caixas" with no size indicated at all):
  → set unit = "uni" (best guess), needs_conversion = true, conversion_note = "Multiplier unknown — box size not stated"

Return this exact JSON structure:
{
  "supplier_name_detected": "<string or null>",
  "invoice_number": "<string or null>",
  "invoice_date": "<YYYY-MM-DD string or null>",
  "currency": "<ISO 4217 code like BRL, USD, EUR — or null>",
  "total_amount": <number or null>,
  "items": [
    {
      "raw_description": "<exact text from invoice>",
      "suggested_name": "<clean concise product name, no size/pack info>",
      "quantity": <CONVERTED total quantity as number, or null>,
      "unit": "<one of: g, ml, L, Kg, uni — NEVER pack/box/dz/etc.>",
      "unit_price": <price per converted unit, recalculated if needed, or null>,
      "line_total": <number or null>,
      "suggested_item_type": "<one of: ingredient, resale_product, ignore, unknown>",
      "needs_conversion": <true if multiplier was unknown, false otherwise>,
      "conversion_note": "<brief explanation of conversion performed, or null>"
    }
  ]
}

Rules for suggested_item_type:
- ingredient: food items used in recipe preparation
- resale_product: finished products sold directly to customers
- ignore: freight, taxes, discounts, service fees, non-product lines
- unknown: unclear what it is`;

let _model = null;

const getModel = () => {
  if (!_model) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    _model = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
  }
  return _model;
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const extractInvoiceFromFile = async (file) => {
  const model = getModel();
  const base64 = await fileToBase64(file);

  const mimeType =
    file.type === 'application/pdf'
      ? 'application/pdf'
      : file.type || 'image/jpeg';

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64,
        mimeType,
      },
    },
    { text: EXTRACTION_PROMPT },
  ]);

  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return null;
  }
};
