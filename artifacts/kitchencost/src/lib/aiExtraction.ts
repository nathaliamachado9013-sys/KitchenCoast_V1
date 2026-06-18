import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from './firebase';

// To change the prompt template, edit EXTRACTION_PROMPT below.
// Template ID for future server-side migration:
export const EXTRACTION_TEMPLATE_ID = 'invoice-extraction-v1';

const EXTRACTION_PROMPT = `You are an expert at extracting structured data from purchase invoices.
Analyze this invoice image or PDF and extract all information listed below.
Return ONLY a valid JSON object matching the schema. Do NOT add markdown formatting or extra text.
If you cannot confidently extract a field, use null — do NOT invent data.

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
      "suggested_name": "<clean concise product name or null>",
      "quantity": <number or null>,
      "unit": "<unit abbreviation like kg, un, L, cx — or null>",
      "unit_price": <number or null>,
      "line_total": <number or null>,
      "suggested_item_type": "<one of: ingredient, resale_product, ignore, unknown>"
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
