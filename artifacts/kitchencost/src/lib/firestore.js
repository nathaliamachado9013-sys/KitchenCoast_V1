import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateId, convertUnits, canConvert } from './utils';

// ====================== RESTAURANT ======================

export const createRestaurant = async (userId, data) => {
  const restaurantId = `rest_${generateId()}`;
  const restaurantRef = doc(db, 'restaurants', restaurantId);
  const restaurant = {
    restaurantId,
    userId,
    name: data.name,
    address: data.address || '',
    phone: data.phone || '',
    currency: data.currency || 'BRL',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(restaurantRef, restaurant);
  // Save restaurantId in user doc
  await setDoc(doc(db, 'users', userId), { restaurantId, email: data.email || '', name: data.name }, { merge: true });
  return { ...restaurant, id: restaurantId };
};

export const getRestaurant = async (restaurantId) => {
  const snap = await getDoc(doc(db, 'restaurants', restaurantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const getRestaurantByUserId = async (userId) => {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists() || !userSnap.data().restaurantId) return null;
  return getRestaurant(userSnap.data().restaurantId);
};

export const updateRestaurant = async (restaurantId, data) => {
  await updateDoc(doc(db, 'restaurants', restaurantId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// ====================== SUPPLIERS ======================

export const getSuppliers = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'suppliers'),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createSupplier = async (restaurantId, data) => {
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'suppliers'), {
    ...data,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
};

export const updateSupplier = async (restaurantId, supplierId, data) => {
  await updateDoc(doc(db, 'restaurants', restaurantId, 'suppliers', supplierId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteSupplier = async (restaurantId, supplierId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'suppliers', supplierId));
};

// ====================== INGREDIENTS ======================

export const getIngredients = async (restaurantId, filters = {}) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'ingredients'),
    orderBy('name')
  );
  const snap = await getDocs(q);
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (filters.search) {
    const s = filters.search.toLowerCase();
    items = items.filter(i => i.name?.toLowerCase().includes(s));
  }
  if (filters.category) {
    items = items.filter(i => i.category === filters.category);
  }
  if (filters.lowStock) {
    items = items.filter(i => i.currentStock <= i.minStock);
  }
  return items;
};

export const createIngredient = async (restaurantId, data) => {
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'ingredients'), {
    ...data,
    restaurantId,
    priceHistory: [{ price: data.costPerUnit, date: new Date().toISOString() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
};

export const updateIngredient = async (restaurantId, ingredientId, data) => {
  const ref = doc(db, 'restaurants', restaurantId, 'ingredients', ingredientId);
  const snap = await getDoc(ref);
  const existing = snap.data();

  let priceHistory = existing?.priceHistory || [];
  if (data.costPerUnit !== undefined && data.costPerUnit !== existing?.costPerUnit) {
    priceHistory = [
      ...priceHistory,
      { price: data.costPerUnit, date: new Date().toISOString() },
    ];
  }

  await updateDoc(ref, { ...data, priceHistory, updatedAt: serverTimestamp() });
};

export const deleteIngredient = async (restaurantId, ingredientId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'ingredients', ingredientId));
};

export const getLowStockIngredients = async (restaurantId) => {
  const ingredients = await getIngredients(restaurantId);
  return ingredients.filter(i => (i.currentStock || 0) <= (i.minStock || 0));
};

export const getInventoryValue = async (restaurantId) => {
  const ingredients = await getIngredients(restaurantId);
  const total = ingredients.reduce((sum, i) => sum + (i.currentStock || 0) * (i.costPerUnit || 0), 0);
  return { totalValue: total, itemCount: ingredients.length };
};

// ====================== RECIPES ======================

const calculateRecipeCost = (recipe, ingredients, operationalCostPerDish = 0) => {
  let ingredientsCost = 0;
  const yieldQty = recipe.yieldQuantity || 1;

  for (const ri of recipe.ingredients || []) {
    const ing = ingredients.find(i => i.id === ri.ingredientId);
    if (!ing) continue;

    let qty = ri.quantity || 0;
    if (ri.unit && ing.unit && ri.unit !== ing.unit && canConvert(ri.unit, ing.unit)) {
      qty = convertUnits(qty, ri.unit, ing.unit);
    }
    ingredientsCost += qty * (ing.costPerUnit || 0);
  }

  const variableCostsTotal = (recipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
  const totalDishCost = ingredientsCost / yieldQty + variableCostsTotal + operationalCostPerDish;
  const sellingPrice = recipe.sellingPrice || 0;
  const profitPerUnit = sellingPrice - totalDishCost;
  const margin = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;

  return {
    costPerPortion: totalDishCost,
    totalDishCost,
    ingredientsCost: ingredientsCost / yieldQty,
    variableCostsTotal,
    profitPerUnit,
    margin,
  };
};

export const getRecipes = async (restaurantId, filters = {}) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'recipes'),
    orderBy('name')
  );
  const snap = await getDocs(q);
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (filters.search) {
    const s = filters.search.toLowerCase();
    items = items.filter(r => r.name?.toLowerCase().includes(s));
  }
  if (filters.category) {
    items = items.filter(r => r.category === filters.category);
  }
  return items;
};

export const createRecipe = async (restaurantId, data, ingredients = [], opCostPerDish = 0) => {
  const costs = calculateRecipeCost(data, ingredients, opCostPerDish);
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'recipes'), {
    ...data,
    ...costs,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data, ...costs };
};

export const updateRecipe = async (restaurantId, recipeId, data, ingredients = [], opCostPerDish = 0) => {
  const costs = calculateRecipeCost(data, ingredients, opCostPerDish);
  await updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipeId), {
    ...data,
    ...costs,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRecipe = async (restaurantId, recipeId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipeId));
};

export const recalculateAllRecipes = async (restaurantId, operationalCosts) => {
  const [recipes, ingredients] = await Promise.all([
    getRecipes(restaurantId),
    getIngredients(restaurantId),
  ]);

  const totalMonthly =
    (operationalCosts?.rent || 0) +
    (operationalCosts?.electricity || 0) +
    (operationalCosts?.water || 0) +
    (operationalCosts?.internet || 0) +
    (operationalCosts?.salaries || 0) +
    (operationalCosts?.accounting || 0) +
    (operationalCosts?.taxes || 0) +
    (operationalCosts?.otherCosts || 0);

  const avgDishes = operationalCosts?.averageDishesPerMonth || 1;
  const opCostPerDish = totalMonthly / avgDishes;

  const updates = recipes.map(recipe => {
    const costs = calculateRecipeCost(recipe, ingredients, opCostPerDish);
    return updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipe.id), {
      ...costs,
      updatedAt: serverTimestamp(),
    });
  });

  await Promise.all(updates);
  return recipes.length;
};

// ====================== OPERATIONAL COSTS ======================

export const getOperationalCosts = async (restaurantId) => {
  const snap = await getDoc(doc(db, 'restaurants', restaurantId, 'settings', 'operational_costs'));
  if (!snap.exists()) return { rent: 0, electricity: 0, water: 0, internet: 0, salaries: 0, accounting: 0, taxes: 0, otherCosts: 0, averageDishesPerMonth: 1 };
  return snap.data();
};

export const updateOperationalCosts = async (restaurantId, data) => {
  await setDoc(
    doc(db, 'restaurants', restaurantId, 'settings', 'operational_costs'),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
};

// ====================== STOCK ======================

export const getStockMovements = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'stock_movements'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createStockEntry = async (restaurantId, data, ingredients) => {
  const ingredient = ingredients.find(i => i.id === data.ingredientId);
  if (!ingredient) throw new Error('Ingrediente não encontrado');

  const newStock = (ingredient.currentStock || 0) + data.quantity;
  const newCost = data.unitCost !== undefined && data.unitCost !== null ? data.unitCost : ingredient.costPerUnit;

  await updateDoc(doc(db, 'restaurants', restaurantId, 'ingredients', data.ingredientId), {
    currentStock: newStock,
    costPerUnit: newCost,
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
    type: 'entry',
    ingredientId: data.ingredientId,
    ingredientName: ingredient.name,
    quantity: data.quantity,
    unit: ingredient.unit,
    unitCost: newCost,
    reason: data.reason || 'compra',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
};

export const createStockExit = async (restaurantId, data, ingredients) => {
  const ingredient = ingredients.find(i => i.id === data.ingredientId);
  if (!ingredient) throw new Error('Ingrediente não encontrado');

  const newStock = Math.max(0, (ingredient.currentStock || 0) - data.quantity);

  await updateDoc(doc(db, 'restaurants', restaurantId, 'ingredients', data.ingredientId), {
    currentStock: newStock,
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
    type: 'exit',
    ingredientId: data.ingredientId,
    ingredientName: ingredient.name,
    quantity: data.quantity,
    unit: ingredient.unit,
    unitCost: ingredient.costPerUnit,
    reason: data.reason || 'saida',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
};

// ====================== PRODUCTION ======================

export const getProductions = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'productions'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// FIX: Calculates cost from CURRENT ingredient prices at registration time
export const registerProduction = async (restaurantId, data, recipes, ingredients) => {
  const recipe = recipes.find(r => r.id === data.recipeId);
  if (!recipe) throw new Error('Receita não encontrada');

  // Recalculate cost with CURRENT ingredient prices (this is the bug fix)
  let ingredientsCost = 0;
  const yieldQty = recipe.yieldQuantity || 1;
  const stockUpdates = [];

  for (const ri of recipe.ingredients || []) {
    const ing = ingredients.find(i => i.id === ri.ingredientId);
    if (!ing) continue;

    let qty = (ri.quantity || 0) * data.quantity;
    if (ri.unit && ing.unit && ri.unit !== ing.unit && canConvert(ri.unit, ing.unit)) {
      qty = convertUnits(qty, ri.unit, ing.unit);
    }
    ingredientsCost += (ri.quantity || 0) * (ing.costPerUnit || 0);

    // Deduct from stock
    const newStock = Math.max(0, (ing.currentStock || 0) - qty);
    stockUpdates.push(
      updateDoc(doc(db, 'restaurants', restaurantId, 'ingredients', ing.id), {
        currentStock: newStock,
        updatedAt: serverTimestamp(),
      })
    );
  }

  const variableCostsTotal = (recipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
  const totalCost = (ingredientsCost / yieldQty + variableCostsTotal) * data.quantity;

  const [ref] = await Promise.all([
    addDoc(collection(db, 'restaurants', restaurantId, 'productions'), {
      recipeId: recipe.id,
      recipeName: recipe.name,
      quantity: data.quantity,
      totalCost,
      costPerUnit: totalCost / data.quantity,
      notes: data.notes || '',
      createdAt: serverTimestamp(),
    }),
    ...stockUpdates,
  ]);

  return { id: ref.id, recipeName: recipe.name, totalCost };
};

export const deleteProduction = async (restaurantId, productionId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'productions', productionId));
};

export const getProductionSummary = async (restaurantId, period = 'today') => {
  const productions = await getProductions(restaurantId);
  const now = new Date();
  let filtered = productions;

  if (period === 'today') {
    filtered = productions.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return d.toDateString() === now.toDateString();
    });
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = productions.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return d >= weekAgo;
    });
  } else if (period === 'month') {
    filtered = productions.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  return {
    count: filtered.length,
    totalCost: filtered.reduce((s, p) => s + (p.totalCost || 0), 0),
  };
};

// ====================== RESALE PRODUCTS ======================

export const getResaleProducts = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'resale_products'),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createResaleProduct = async (restaurantId, data) => {
  const profitPerUnit = (data.salePrice || 0) - (data.purchasePrice || 0);
  const margin = data.salePrice > 0 ? (profitPerUnit / data.salePrice) * 100 : 0;

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'resale_products'), {
    ...data,
    profitPerUnit,
    margin,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data, profitPerUnit, margin };
};

export const updateResaleProduct = async (restaurantId, productId, data) => {
  const profitPerUnit = (data.salePrice || 0) - (data.purchasePrice || 0);
  const margin = data.salePrice > 0 ? (profitPerUnit / data.salePrice) * 100 : 0;
  await updateDoc(doc(db, 'restaurants', restaurantId, 'resale_products', productId), {
    ...data,
    profitPerUnit,
    margin,
    updatedAt: serverTimestamp(),
  });
};

export const deleteResaleProduct = async (restaurantId, productId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'resale_products', productId));
};

// ====================== MENU ITEMS ======================

export const getMenuItems = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'menu_items'),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createMenuItem = async (restaurantId, data) => {
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'menu_items'), {
    ...data,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
};

export const updateMenuItem = async (restaurantId, itemId, data) => {
  await updateDoc(doc(db, 'restaurants', restaurantId, 'menu_items', itemId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteMenuItem = async (restaurantId, itemId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'menu_items', itemId));
};

// ====================== MENU CATEGORIES ======================

export const getMenuCategories = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'menu_categories'),
    orderBy('displayOrder')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createMenuCategory = async (restaurantId, name) => {
  const existing = await getMenuCategories(restaurantId);
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'menu_categories'), {
    name,
    displayOrder: existing.length,
    restaurantId,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name, displayOrder: existing.length };
};

export const updateMenuCategory = async (restaurantId, categoryId, data) => {
  await updateDoc(doc(db, 'restaurants', restaurantId, 'menu_categories', categoryId), data);
};

export const deleteMenuCategory = async (restaurantId, categoryId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'menu_categories', categoryId));
};

// ====================== SALES ======================

export const getSales = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'sales'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createSale = async (restaurantId, data, menuItems) => {
  const item = menuItems.find(m => m.id === data.itemId);
  if (!item) throw new Error('Item não encontrado no cardápio');

  const salePrice = data.salePrice !== undefined ? data.salePrice : (item.salePrice || 0);
  const cost = item.cost || item.costPerPortion || 0;
  const profit = (salePrice - cost) * data.quantitySold;
  const revenue = salePrice * data.quantitySold;

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'sales'), {
    itemId: item.id,
    itemName: item.name,
    itemType: item.itemType || 'recipe',
    quantitySold: data.quantitySold,
    salePrice,
    cost,
    profit,
    revenue,
    salesChannel: data.salesChannel || '',
    notes: data.notes || '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, profit, revenue };
};

export const deleteSale = async (restaurantId, saleId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'sales', saleId));
};

export const getSalesSummary = async (restaurantId, period = 'today') => {
  const sales = await getSales(restaurantId);
  const now = new Date();
  let filtered = sales;

  if (period === 'today') {
    filtered = sales.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
      return d.toDateString() === now.toDateString();
    });
  } else if (period === 'month') {
    filtered = sales.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  return {
    count: filtered.length,
    totalRevenue: filtered.reduce((s, sale) => s + (sale.revenue || 0), 0),
    totalProfit: filtered.reduce((s, sale) => s + (sale.profit || 0), 0),
  };
};

// ====================== DASHBOARD ======================

export const getDashboardSummary = async (restaurantId) => {
  const [ingredients, recipes, suppliers, sales, productions] = await Promise.all([
    getIngredients(restaurantId),
    getRecipes(restaurantId),
    getSuppliers(restaurantId),
    getSales(restaurantId),
    getProductions(restaurantId),
  ]);

  const lowStockAlerts = ingredients.filter(i => (i.currentStock || 0) <= (i.minStock || 0));
  const inventoryValue = ingredients.reduce((s, i) => s + (i.currentStock || 0) * (i.costPerUnit || 0), 0);

  const now = new Date();
  const todayProductions = productions.filter(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    return d.toDateString() === now.toDateString();
  });
  const todayProductionCost = todayProductions.reduce((s, p) => s + (p.totalCost || 0), 0);

  const monthSales = sales.filter(s => {
    const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const averageMargin =
    recipes.length > 0
      ? recipes.reduce((s, r) => s + (r.margin || 0), 0) / recipes.length
      : 0;

  return {
    ingredientsCount: ingredients.length,
    recipesCount: recipes.length,
    suppliersCount: suppliers.length,
    lowStockAlerts: lowStockAlerts.length,
    inventoryValue,
    todayProductionCost,
    averageMargin: Math.round(averageMargin * 10) / 10,
    monthRevenue: monthSales.reduce((s, sale) => s + (sale.revenue || 0), 0),
    monthProfit: monthSales.reduce((s, sale) => s + (sale.profit || 0), 0),
  };
};

// ====================== REPORTS (FIX: live calculation) ======================

export const getMenuProfitability = async (restaurantId, period = 'month') => {
  const [menuItems, sales, recipes, resaleProducts] = await Promise.all([
    getMenuItems(restaurantId),
    getSales(restaurantId),
    getRecipes(restaurantId),
    getResaleProducts(restaurantId),
  ]);

  const now = new Date();
  let filteredSales = sales;

  if (period === 'today') {
    filteredSales = sales.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
      return d.toDateString() === now.toDateString();
    });
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filteredSales = sales.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
      return d >= weekAgo;
    });
  } else if (period === 'month') {
    filteredSales = sales.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (period === 'year') {
    filteredSales = sales.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
      return d.getFullYear() === now.getFullYear();
    });
  }

  // Build items list from menu items + enrich with recipe/product data
  const allItems = menuItems.map(item => {
    let cost = 0;
    let salePrice = item.salePrice || 0;

    if (item.itemType === 'recipe') {
      const recipe = recipes.find(r => r.id === item.recipeId);
      cost = recipe?.costPerPortion || item.cost || 0;
    } else if (item.itemType === 'resale_product') {
      const product = resaleProducts.find(p => p.id === item.productId);
      cost = product?.purchasePrice || item.cost || 0;
    }

    const itemSales = filteredSales.filter(s => s.itemId === item.id);
    const unitsSold = itemSales.reduce((s, sale) => s + (sale.quantitySold || 0), 0);
    const totalRevenue = itemSales.reduce((s, sale) => s + (sale.revenue || 0), 0);
    const profitPerUnit = salePrice - cost;
    const totalProfit = profitPerUnit * unitsSold;

    return {
      id: item.id,
      name: item.name,
      category: item.category || '',
      cost,
      salePrice,
      profitPerUnit,
      unitsSold,
      totalRevenue,
      totalProfit,
    };
  });

  // Menu engineering classification
  const withSales = allItems.filter(i => i.unitsSold > 0 || i.profitPerUnit > 0);
  const avgUnits = withSales.length > 0 ? withSales.reduce((s, i) => s + i.unitsSold, 0) / withSales.length : 0;
  const avgProfit = withSales.length > 0 ? withSales.reduce((s, i) => s + i.profitPerUnit, 0) / withSales.length : 0;

  const classified = allItems.map(item => {
    let classification = 'UNCLASSIFIED';
    if (item.salePrice > 0) {
      if (item.unitsSold >= avgUnits && item.profitPerUnit >= avgProfit) classification = 'STAR';
      else if (item.unitsSold >= avgUnits && item.profitPerUnit < avgProfit) classification = 'PLOWHORSE';
      else if (item.unitsSold < avgUnits && item.profitPerUnit >= avgProfit) classification = 'PUZZLE';
      else classification = 'DOG';
    }
    return { ...item, classification };
  });

  classified.sort((a, b) => b.totalProfit - a.totalProfit);

  return {
    period,
    items: classified,
    summary: {
      totalItems: classified.length,
      totalProfit: classified.reduce((s, i) => s + i.totalProfit, 0),
      totalRevenue: classified.reduce((s, i) => s + i.totalRevenue, 0),
      totalItemsSold: classified.reduce((s, i) => s + i.unitsSold, 0),
    },
    topProfitable: classified.slice(0, 5),
  };
};

export const getCostReport = async (restaurantId, period = 'month') => {
  const [productions, ingredients] = await Promise.all([
    getProductions(restaurantId),
    getIngredients(restaurantId),
  ]);

  const now = new Date();
  let filtered = productions;
  if (period === 'month') {
    filtered = productions.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  const byRecipe = {};
  filtered.forEach(p => {
    if (!byRecipe[p.recipeName]) byRecipe[p.recipeName] = { name: p.recipeName, totalCost: 0, count: 0 };
    byRecipe[p.recipeName].totalCost += p.totalCost || 0;
    byRecipe[p.recipeName].count += p.quantity || 1;
  });

  return {
    period,
    totalCost: filtered.reduce((s, p) => s + (p.totalCost || 0), 0),
    productionCount: filtered.length,
    byRecipe: Object.values(byRecipe).sort((a, b) => b.totalCost - a.totalCost),
  };
};

export const getMarginReport = async (restaurantId) => {
  const recipes = await getRecipes(restaurantId);

  const withMargins = recipes.filter(r => r.sellingPrice > 0 && r.costPerPortion !== undefined);

  const distribution = { negative: 0, low: 0, medium: 0, good: 0, excellent: 0 };
  withMargins.forEach(r => {
    const m = r.margin || 0;
    if (m < 0) distribution.negative++;
    else if (m < 20) distribution.low++;
    else if (m < 40) distribution.medium++;
    else if (m < 60) distribution.good++;
    else distribution.excellent++;
  });

  return {
    recipes: withMargins.map(r => ({
      name: r.name,
      category: r.category,
      cost: r.costPerPortion || 0,
      sellingPrice: r.sellingPrice || 0,
      margin: r.margin || 0,
      profit: r.profitPerUnit || 0,
    })),
    distribution,
    averageMargin: withMargins.length > 0 ? withMargins.reduce((s, r) => s + (r.margin || 0), 0) / withMargins.length : 0,
  };
};
