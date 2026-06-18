#!/usr/bin/env node

/**
 * Script para popular Firestore via REST API
 * Adiciona ingredientes, fornecedor e receitas para Pizzaria Napoletana
 */

const API_BASE = 'https://firestore.googleapis.com/v1/projects';
const PROJECT_ID = 'kitchencost-e1a2e'; // Extraído da URL do app
const API_KEY = 'sua_api_key_aqui'; // Será substituído
const RESTAURANT_ID = 'pizza-napoletana';

const INGREDIENTS = [
  { name: 'Farinha de Trigo', category: 'Grãos', unitType: 'kg', costPerUnit: 8.00 },
  { name: 'Tomates Pelados', category: 'Produtos Enlatados', unitType: 'lata', costPerUnit: 0.90 },
  { name: 'Azeite Extravirgem', category: 'Óleos', unitType: 'L', costPerUnit: 8.00 },
  { name: 'Sal Marinho', category: 'Temperos', unitType: 'kg', costPerUnit: 2.00 },
  { name: 'Fermento Fresco', category: 'Fermentação', unitType: 'kg', costPerUnit: 12.00 },
  { name: 'Manjericão Fresco', category: 'Ervas', unitType: 'kg', costPerUnit: 15.00 },
  { name: 'Mozzarella Fresca', category: 'Queijos', unitType: 'kg', costPerUnit: 10.00 },
  { name: 'Presunto Ibérico', category: 'Embutidos', unitType: 'kg', costPerUnit: 22.00 },
  { name: 'Ovos Extra', category: 'Ovos', unitType: 'dúzia', costPerUnit: 2.00 },
  { name: 'Azeitonas Pretas', category: 'Conservas', unitType: 'kg', costPerUnit: 6.00 },
  { name: 'Água Mineral', category: 'Bebidas', unitType: 'garrafa', costPerUnit: 0.50 },
  { name: 'Refrigerante Cola', category: 'Bebidas', unitType: 'garrafa', costPerUnit: 1.50 },
  { name: 'Vinho Branco', category: 'Bebidas Alcoólicas', unitType: 'garrafa', costPerUnit: 5.00 },
  { name: 'Vinho Tinto', category: 'Bebidas Alcoólicas', unitType: 'garrafa', costPerUnit: 8.00 },
];

const SUPPLIER = {
  name: 'Makro Portugal',
  contactPerson: 'Gestor de Contas',
  phone: '(+351) 253 100 100',
  email: 'contato@makro.pt',
  address: 'Rua da Indústria, 123, 4715-390 Braga',
};

/**
 * Converte valor JS para formato Firestore REST
 */
function valueToFirestore(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valueToFirestore) } };
  if (typeof value === 'object' && value !== null) {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = valueToFirestore(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

/**
 * Cria documento no Firestore via REST
 */
async function createDocument(collectionPath, documentData) {
  const url = `${API_BASE}/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?key=${API_KEY}`;

  const fields = {};
  for (const [key, value] of Object.entries(documentData)) {
    fields[key] = valueToFirestore(value);
  }

  const body = {
    fields,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`${response.status}: ${error.error?.message || 'Erro desconhecido'}`);
    }

    const data = await response.json();
    const docId = data.name?.split('/').pop();
    return docId;
  } catch (error) {
    throw new Error(`Falha ao criar documento: ${error.message}`);
  }
}

async function main() {
  console.log('🌱 Iniciando população de dados...\n');

  if (API_KEY === 'sua_api_key_aqui') {
    console.error('❌ ERRO: API_KEY não foi configurada!');
    console.error('Abra o arquivo populate-firestore.js e substitua:');
    console.error('  const API_KEY = "sua_api_key_aqui";');
    console.error('por sua chave real do Firebase.\n');
    console.error('Para encontrar sua API Key:');
    console.error('  1. Abra Firebase Console: https://console.firebase.google.com');
    console.error('  2. Selecione seu projeto');
    console.error('  3. Settings (engrenagem) → Project Settings');
    console.error('  4. Abra aba "Service Accounts"');
    console.error('  5. Copie a chave "Browser API key"\n');
    process.exit(1);
  }

  try {
    console.log('📦 Adicionando ingredientes...');
    for (const ing of INGREDIENTS) {
      const docId = await createDocument(
        `restaurants/${RESTAURANT_ID}/ingredients`,
        {
          name: ing.name,
          category: ing.category,
          unitType: ing.unitType,
          costPerUnit: ing.costPerUnit,
          currentStock: 0,
          minStock: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      console.log(`  ✅ ${ing.name} (ID: ${docId})`);
    }

    console.log('\n🏪 Adicionando fornecedor...');
    const supplierId = await createDocument(
      `restaurants/${RESTAURANT_ID}/suppliers`,
      {
        name: SUPPLIER.name,
        contactPerson: SUPPLIER.contactPerson,
        phone: SUPPLIER.phone,
        email: SUPPLIER.email,
        address: SUPPLIER.address,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    console.log(`  ✅ ${SUPPLIER.name} (ID: ${supplierId})`);

    console.log('\n✨ População completada com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`  - ${INGREDIENTS.length} ingredientes adicionados`);
    console.log(`  - 1 fornecedor adicionado`);
    console.log(`  - ID do Restaurante: ${RESTAURANT_ID}`);
    console.log(`\n💡 Próximas etapas:`);
    console.log(`  1. Atualize o app no navegador (F5)`);
    console.log(`  2. Navegue para "Ingredientes" e verifique os dados`);
    console.log(`  3. Crie receitas manualmente ou modifique este script`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
