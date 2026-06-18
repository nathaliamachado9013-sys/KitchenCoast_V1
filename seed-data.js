#!/usr/bin/env node

/**
 * Script para popular dados da Pizzaria Napoletana no Firestore
 * Uso: node seed-data.js <restaurantId>
 */

const {
  initializeApp,
  cert,
} = require('firebase-admin/app');
const {
  getFirestore,
  FieldValue,
  Timestamp,
  serverTimestamp,
} = require('firebase-admin/firestore');

// Para executar isso, você precisa:
// 1. Ter Firebase Admin SDK instalado: npm install firebase-admin
// 2. Ter um arquivo service-account.json com as credenciais
// 3. Definir GOOGLE_APPLICATION_CREDENTIALS

const db = getFirestore();

const RESTAURANT_ID = 'pizza-napoletana-braga'; // Será substituído pelo ID real

// Dados dos ingredientes
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

// Fornecedor
const SUPPLIER = {
  name: 'Makro Portugal',
  contactPerson: 'Gestor de Contas',
  phone: '(+351) 253 100 100',
  email: 'contato@makro.pt',
  address: 'Rua da Indústria, 123, 4715-390 Braga',
};

// Receitas (Fichas Técnicas)
const RECIPES = [
  {
    name: 'Massa de Pizza Napoletana',
    description: 'Massa tradicional feita semanalmente',
    yieldQuantity: 2857, // porções de 35g
    yieldUnit: 'porção',
    ingredients: [
      { ingredientName: 'Farinha de Trigo', quantity: 80, unit: 'kg' },
      { ingredientName: 'Água Mineral', quantity: 15, unit: 'L' },
      { ingredientName: 'Sal Marinho', quantity: 2, unit: 'kg' },
      { ingredientName: 'Fermento Fresco', quantity: 3, unit: 'kg' },
    ],
  },
  {
    name: 'Molho de Tomate Caseiro',
    description: 'Molho de tomate fresco',
    yieldQuantity: 40,
    yieldUnit: 'porção',
    ingredients: [
      { ingredientName: 'Tomates Pelados', quantity: 1, unit: 'lata' },
      { ingredientName: 'Azeite Extravirgem', quantity: 0.05, unit: 'L' },
      { ingredientName: 'Sal Marinho', quantity: 0.005, unit: 'kg' },
      { ingredientName: 'Manjericão Fresco', quantity: 0.01, unit: 'kg' },
    ],
  },
  {
    name: 'Margherita',
    description: 'Pizza clássica com tomate e mozzarella',
    yieldQuantity: 1,
    yieldUnit: 'pizza',
    ingredients: [
      { ingredientName: 'Massa de Pizza Napoletana', quantity: 35, unit: 'g' },
      { ingredientName: 'Molho de Tomate Caseiro', quantity: 30, unit: 'g' },
      { ingredientName: 'Mozzarella Fresca', quantity: 60, unit: 'g' },
      { ingredientName: 'Manjericão Fresco', quantity: 3, unit: 'g' },
    ],
  },
  {
    name: 'Quattro Formaggi',
    description: 'Pizza com quatro tipos de queijo',
    yieldQuantity: 1,
    yieldUnit: 'pizza',
    ingredients: [
      { ingredientName: 'Massa de Pizza Napoletana', quantity: 35, unit: 'g' },
      { ingredientName: 'Molho de Tomate Caseiro', quantity: 30, unit: 'g' },
      { ingredientName: 'Mozzarella Fresca', quantity: 80, unit: 'g' },
    ],
  },
  {
    name: 'Prosciutto e Rúcula',
    description: 'Pizza com presunto ibérico e rúcula',
    yieldQuantity: 1,
    yieldUnit: 'pizza',
    ingredients: [
      { ingredientName: 'Massa de Pizza Napoletana', quantity: 35, unit: 'g' },
      { ingredientName: 'Molho de Tomate Caseiro', quantity: 30, unit: 'g' },
      { ingredientName: 'Presunto Ibérico', quantity: 40, unit: 'g' },
    ],
  },
];

async function seedData() {
  try {
    console.log('🌱 Iniciando seed de dados...\n');

    // 1. Adicionar ingredientes
    console.log('📦 Adicionando ingredientes...');
    const ingredientRefs = {};

    for (const ing of INGREDIENTS) {
      const docRef = db.collection('restaurants')
        .doc(RESTAURANT_ID)
        .collection('ingredients')
        .doc();

      await docRef.set({
        ...ing,
        currentStock: 0,
        minStock: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      ingredientRefs[ing.name] = docRef.id;
      console.log(`  ✅ ${ing.name}`);
    }

    // 2. Adicionar fornecedor
    console.log('\n🏪 Adicionando fornecedor...');
    const supplierRef = db.collection('restaurants')
      .doc(RESTAURANT_ID)
      .collection('suppliers')
      .doc();

    await supplierRef.set({
      ...SUPPLIER,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const supplierId = supplierRef.id;
    console.log(`  ✅ ${SUPPLIER.name}`);

    // 3. Adicionar receitas
    console.log('\n📝 Adicionando receitas...');
    const recipeRefs = {};

    for (const recipe of RECIPES) {
      const recipeRef = db.collection('restaurants')
        .doc(RESTAURANT_ID)
        .collection('recipes')
        .doc();

      // Mapear ingredientes para referências
      const mappedIngredients = recipe.ingredients.map(ing => ({
        ...ing,
        ingredientId: ingredientRefs[ing.ingredientName],
      }));

      await recipeRef.set({
        name: recipe.name,
        description: recipe.description,
        yieldQuantity: recipe.yieldQuantity,
        yieldUnit: recipe.yieldUnit,
        ingredients: mappedIngredients,
        costPerPortion: 0, // Será calculado depois
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      recipeRefs[recipe.name] = recipeRef.id;
      console.log(`  ✅ ${recipe.name}`);
    }

    console.log('\n✨ Seed completado com sucesso!');
    console.log(`\n📊 Resumo:`);
    console.log(`  - ${INGREDIENTS.length} ingredientes adicionados`);
    console.log(`  - ${RECIPES.length} receitas adicionadas`);
    console.log(`  - 1 fornecedor adicionado`);
    console.log(`\n💾 ID do Restaurante: ${RESTAURANT_ID}`);
    console.log(`🏪 ID do Fornecedor: ${supplierId}`);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

// Executar
seedData().then(() => process.exit(0));
