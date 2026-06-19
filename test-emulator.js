#!/usr/bin/env node

/**
 * Pizza Napoletana Test Data Generator
 * Creates test data in Firebase Emulator to validate all 11 bug fixes
 */

const admin = require('firebase-admin');

// Point to emulator BEFORE initializing
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

// Initialize Firebase Admin SDK pointing to emulator
const options = {
  projectId: 'demo-kitchencost',
};

admin.initializeApp(options);

const db = admin.firestore();
const auth = admin.auth();

async function createTestData() {
  try {
    console.log('🚀 Starting Pizza Napoletana test data creation...\n');

    // Step 1: Create Auth User
    console.log('1️⃣  Creating test user...');
    let user;
    try {
      user = await auth.createUser({
        email: 'test@pizzanapoletana.com',
        password: 'TestPassword123!',
        displayName: 'Test User'
      });
      console.log(`   ✅ User created: ${user.uid}\n`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        console.log('   ✅ User already exists, using existing\n');
        const users = await auth.listUsers(1);
        user = users.users[0];
      } else {
        throw err;
      }
    }

    const userId = user.uid;

    // Step 2: Create Restaurant
    console.log('2️⃣  Creating Pizza Napoletana restaurant...');
    const restaurantId = `rest_${Date.now()}`;
    const restaurantRef = db.collection('restaurants').doc(restaurantId);

    await restaurantRef.set({
      name: 'Pizza Napoletana',
      ownerUid: userId,
      currency: 'EUR',
      address: 'Lisboa, Portugal',
      phone: '+351 21 123 4567',
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create owner member
    await restaurantRef.collection('members').doc(userId).set({
      uid: userId,
      email: 'test@pizzanapoletana.com',
      displayName: 'Test User',
      role: 'owner',
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create user doc
    await db.collection('users').doc(userId).set({
      email: 'test@pizzanapoletana.com',
      displayName: 'Test User',
      restaurantId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`   ✅ Restaurant created: ${restaurantId}\n`);

    // Step 3: Create Ingredients
    console.log('3️⃣  Creating ingredients...');
    const ingredients = [
      { name: 'Farinha de Trigo', unit: 'g', costPerUnit: 1.42, minStock: 5000, currentStock: 25000 },
      { name: 'Molho de Tomate', unit: 'ml', costPerUnit: 0.003, minStock: 5000, currentStock: 20000 },
      { name: 'Mozzarella Fior di Latte', unit: 'g', costPerUnit: 8.5, minStock: 2000, currentStock: 8000 },
      { name: 'Azeite Virgem Extra', unit: 'ml', costPerUnit: 0.018, minStock: 1000, currentStock: 5000 },
      { name: 'Sal Marinho', unit: 'g', costPerUnit: 0.02, minStock: 500, currentStock: 2000 },
      { name: 'Levadura Fresca', unit: 'g', costPerUnit: 0.5, minStock: 100, currentStock: 500 },
    ];

    const ingredientIds = {};
    for (const ing of ingredients) {
      const ingId = `ing_${Date.now()}_${Math.random()}`;
      ingredientIds[ing.name] = ingId;

      await restaurantRef.collection('ingredients').doc(ingId).set({
        name: ing.name,
        unit: ing.unit,
        costPerUnit: ing.costPerUnit,
        minStock: ing.minStock,
        currentStock: ing.currentStock,
        supplier: 'Makro Portugal',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${ing.name}`);
    }
    console.log();

    // Step 4: Create Invoices (Purchases from Makro)
    console.log('4️⃣  Creating purchase invoices from Makro Portugal...');
    const invoices = [
      {
        supplierId: 'makro_001',
        supplierName: 'Makro Portugal',
        totalAmount: 1250.75,
        invoiceNumber: 'INV-2024-001',
        lines: [
          { ingredientId: ingredientIds['Farinha de Trigo'], quantity: 25000, unit: 'g', unitPrice: 0.035, lineTotal: 875 },
          { ingredientId: ingredientIds['Molho de Tomate'], quantity: 20000, unit: 'ml', unitPrice: 0.06, lineTotal: 1200 },
          { ingredientId: ingredientIds['Mozzarella Fior di Latte'], quantity: 8000, unit: 'g', unitPrice: 0.088, lineTotal: 704 },
        ]
      },
      {
        supplierId: 'makro_002',
        supplierName: 'Makro Portugal',
        totalAmount: 450.25,
        invoiceNumber: 'INV-2024-002',
        lines: [
          { ingredientId: ingredientIds['Azeite Virgem Extra'], quantity: 5000, unit: 'ml', unitPrice: 0.09, lineTotal: 450 },
        ]
      },
    ];

    for (const inv of invoices) {
      const invId = `inv_${Date.now()}_${Math.random()}`;
      await restaurantRef.collection('invoices').doc(invId).set({
        supplierId: inv.supplierId,
        supplierName: inv.supplierName,
        totalAmount: inv.totalAmount,
        invoiceNumber: inv.invoiceNumber,
        lines: inv.lines,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${inv.invoiceNumber} - €${inv.totalAmount}`);
    }
    console.log();

    // Step 5: Create Recipes
    console.log('5️⃣  Creating pizza recipes...');
    const recipes = [
      {
        name: 'Massa de Pizza',
        yieldQuantity: 10,
        yieldUnit: 'porções',
        ingredients: [
          { ingredientId: ingredientIds['Farinha de Trigo'], quantity: 500, unit: 'g' },
          { ingredientId: ingredientIds['Água Filtrada'], quantity: 250, unit: 'ml' },
          { ingredientId: ingredientIds['Levadura Fresca'], quantity: 5, unit: 'g' },
          { ingredientId: ingredientIds['Sal Marinho'], quantity: 10, unit: 'g' },
          { ingredientId: ingredientIds['Azeite Virgem Extra'], quantity: 25, unit: 'ml' },
        ],
        variableCosts: [
          { name: 'Embalagem', value: 0.50 }
        ],
        sellingPrice: 8.50,
      },
      {
        name: 'Molho de Tomate Caseiro',
        yieldQuantity: 10,
        yieldUnit: 'porções',
        ingredients: [
          { ingredientId: ingredientIds['Molho de Tomate'], quantity: 1000, unit: 'ml' },
          { ingredientId: ingredientIds['Azeite Virgem Extra'], quantity: 50, unit: 'ml' },
          { ingredientId: ingredientIds['Sal Marinho'], quantity: 5, unit: 'g' },
        ],
        variableCosts: [
          { name: 'Embalagem', value: 0.20 }
        ],
        sellingPrice: 3.50,
      },
      {
        name: 'Pizza Margherita',
        yieldQuantity: 1,
        yieldUnit: 'porções',
        ingredients: [
          { ingredientId: ingredientIds['Mozzarella Fior di Latte'], quantity: 150, unit: 'g' },
          { ingredientId: ingredientIds['Azeite Virgem Extra'], quantity: 15, unit: 'ml' },
        ],
        variableCosts: [],
        sellingPrice: 12.50,
      },
    ];

    const recipeIds = {};
    for (const rec of recipes) {
      const recId = `rec_${Date.now()}_${Math.random()}`;
      recipeIds[rec.name] = recId;

      await restaurantRef.collection('recipes').doc(recId).set({
        name: rec.name,
        yieldQuantity: rec.yieldQuantity,
        yieldUnit: rec.yieldUnit,
        ingredients: rec.ingredients,
        variableCosts: rec.variableCosts,
        sellingPrice: rec.sellingPrice,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${rec.name}`);
    }
    console.log();

    // Step 6: Create Menu Items (Pizzas linking to Massa + Molho + Cheese)
    console.log('6️⃣  Creating menu items with MULTIPLE recipes...');
    const menuItems = [
      {
        name: 'Pizza Margherita Clássica',
        recipeIds: [
          recipeIds['Massa de Pizza'],
          recipeIds['Molho de Tomate Caseiro'],
          recipeIds['Pizza Margherita']
        ],
        price: 14.90,
        category: 'Pizzas'
      },
    ];

    const menuItemIds = {};
    for (const item of menuItems) {
      const miId = `menu_${Date.now()}_${Math.random()}`;
      menuItemIds[item.name] = miId;

      // ERRO #7 FIX: This should support MULTIPLE recipeIds, not just one!
      await restaurantRef.collection('menu_items').doc(miId).set({
        name: item.name,
        recipeIds: item.recipeIds,  // ARRAY of recipes, not single recipeId
        price: item.price,
        category: item.category,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${item.name} (${item.recipeIds.length} recipes linked)`);
    }
    console.log();

    console.log('✅ TEST DATA CREATED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log(`   Restaurant: Pizza Napoletana (${restaurantId})`);
    console.log(`   User: test@pizzanapoletana.com / TestPassword123!`);
    console.log(`   Ingredients: ${ingredients.length}`);
    console.log(`   Invoices: ${invoices.length}`);
    console.log(`   Recipes: ${recipes.length}`);
    console.log(`   Menu Items: ${menuItems.length}`);
    console.log('\n🔗 Open app: http://localhost:5174/');
    console.log('📊 Emulator UI: http://127.0.0.1:4000/\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  }
}

createTestData();
