import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateId, convertUnits, canConvert } from './utils';

// ====================== RESTAURANT & MEMBERS ======================

export const createRestaurant = async (userId, data) => {
  const restaurantId = `rest_${generateId()}`;
  const restaurantRef = doc(db, 'restaurants', restaurantId);

  // Step 1: Create restaurant doc with ownerUid
  const restaurant = {
    name: data.name,
    ownerUid: userId,
    currency: data.currency || 'BRL',
    address: data.address || '',
    phone: data.phone || '',
    active: true,
    createdAt: serverTimestamp(),
  };
  await setDoc(restaurantRef, restaurant);

  // Step 2: Create owner member doc (bootstrap)
  const memberRef = doc(db, 'restaurants', restaurantId, 'members', userId);
  await setDoc(memberRef, {
    uid: userId,
    email: data.email || '',
    displayName: data.displayName || '',
    role: 'owner',
    active: true,
    createdAt: serverTimestamp(),
  });

  // Step 3: Save restaurantId in users doc for fast lookup
  await setDoc(doc(db, 'users', userId), {
    email: data.email || '',
    displayName: data.displayName || data.name || '',
    restaurantId,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true });

  return { id: restaurantId, restaurantId, ...restaurant };
};

export const getRestaurant = async (restaurantId) => {
  const snap = await getDoc(doc(db, 'restaurants', restaurantId));
  if (!snap.exists()) return null;
  return { id: snap.id, restaurantId: snap.id, ...snap.data() };
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

// ====================== MEMBER ROLES ======================

export const getMember = async (restaurantId, userId) => {
  const snap = await getDoc(doc(db, 'restaurants', restaurantId, 'members', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const getMembers = async (restaurantId) => {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const inviteMember = async (restaurantId, data) => {
  const ref = doc(db, 'restaurants', restaurantId, 'members', data.uid);
  await setDoc(ref, {
    uid: data.uid,
    email: data.email || '',
    displayName: data.displayName || '',
    role: data.role || 'staff',
    active: true,
    createdAt: serverTimestamp(),
  });
};

export const updateMember = async (restaurantId, memberId, data) => {
  await updateDoc(doc(db, 'restaurants', restaurantId, 'members', memberId), data);
};

export const removeMember = async (restaurantId, memberId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'members', memberId));
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
  const { restaurantId: _r, ...cleanData } = data;
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'suppliers'), {
    name: cleanData.name,
    contactName: cleanData.contactName || '',
    email: cleanData.email || '',
    phone: cleanData.phone || '',
    notes: cleanData.notes || '',
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...cleanData };
};

export const updateSupplier = async (restaurantId, supplierId, data) => {
  const { restaurantId: _r, ...cleanData } = data;
  await updateDoc(doc(db, 'restaurants', restaurantId, 'suppliers', supplierId), {
    ...cleanData,
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
  const { restaurantId: _r, ...cleanData } = data;
  const initialStock = cleanData.currentStock || 0;
  const unitCost = cleanData.costPerUnit || 0;
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'ingredients'), {
    name: cleanData.name,
    unit: cleanData.unit,
    costPerUnit: unitCost,
    averageCost: unitCost,
    supplierId: cleanData.supplierId || null,
    notes: cleanData.notes || '',
    category: cleanData.category || '',
    currentStock: initialStock,
    minStock: cleanData.minStock || 0,
    priceHistory: [{ price: unitCost, date: new Date().toISOString() }],
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (initialStock > 0) {
    await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
      type: 'in',
      ingredientId: ref.id,
      ingredientName: cleanData.name,
      quantity: initialStock,
      unit: cleanData.unit,
      unitCost,
      averageCostAfter: unitCost,
      referenceType: 'adjustment',
      notes: 'Estoque inicial (ajuste de abertura)',
      createdAt: serverTimestamp(),
    });
  }
  return { id: ref.id, ...cleanData };
};

export const updateIngredient = async (restaurantId, ingredientId, data) => {
  const ref = doc(db, 'restaurants', restaurantId, 'ingredients', ingredientId);
  const snap = await getDoc(ref);
  const existing = snap.data();
  const { restaurantId: _r, ...cleanData } = data;

  let priceHistory = existing?.priceHistory || [];
  if (cleanData.costPerUnit !== undefined && cleanData.costPerUnit !== existing?.costPerUnit) {
    priceHistory = [
      ...priceHistory,
      { price: cleanData.costPerUnit, date: new Date().toISOString() },
    ];
  }

  await updateDoc(ref, { ...cleanData, priceHistory, updatedAt: serverTimestamp() });
};

export const deleteIngredient = async (restaurantId, ingredientId) => {
  await deleteDoc(doc(db, 'restaurants', restaurantId, 'ingredients', ingredientId));
};

export const getLowStockIngredients = async (restaurantId) => {
  const ingredients = await getIngredients(restaurantId);
  return ingredients.filter(i => (i.currentStock || 0) <= (i.minStock || 0));
};

export const getInventoryValue = async (restaurantId) => {
  const [ingredients, resaleProducts] = await Promise.all([
    getIngredients(restaurantId),
    getResaleProducts(restaurantId),
  ]);
  const ingTotal = ingredients.reduce((sum, i) => sum + (i.currentStock || 0) * (i.averageCost || i.costPerUnit || 0), 0);
  const resaleTotal = resaleProducts.reduce((sum, p) => sum + (p.stockQuantity || p.currentStock || 0) * (p.averageCost || p.cost || 0), 0);
  return {
    totalValue: ingTotal + resaleTotal,
    itemCount: ingredients.length + resaleProducts.length,
    ingredientsCount: ingredients.length,
    resaleCount: resaleProducts.length,
  };
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
    ingredientsCost += qty * (ing.averageCost || ing.costPerUnit || 0);
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
  const { restaurantId: _r, ...cleanData } = data;
  const costs = calculateRecipeCost(cleanData, ingredients, opCostPerDish);
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'recipes'), {
    ...cleanData,
    ...costs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...cleanData, ...costs };
};

export const updateRecipe = async (restaurantId, recipeId, data, ingredients = [], opCostPerDish = 0) => {
  const { restaurantId: _r, ...cleanData } = data;
  const costs = calculateRecipeCost(cleanData, ingredients, opCostPerDish);
  await updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipeId), {
    ...cleanData,
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

  const currentQty = ingredient.currentStock || 0;
  const currentAvgCost = ingredient.averageCost || ingredient.costPerUnit || 0;
  const newStock = currentQty + data.quantity;

  let newCost;
  if (data.unitCost !== undefined && data.unitCost !== null && data.unitCost > 0) {
    const currentTotalValue = currentQty * currentAvgCost;
    const incomingValue = data.quantity * data.unitCost;
    newCost = newStock > 0 ? (currentTotalValue + incomingValue) / newStock : data.unitCost;
  } else {
    newCost = currentAvgCost;
  }

  await updateDoc(doc(db, 'restaurants', restaurantId, 'ingredients', data.ingredientId), {
    currentStock: newStock,
    costPerUnit: newCost,
    averageCost: newCost,
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
    type: 'in',
    ingredientId: data.ingredientId,
    ingredientName: ingredient.name,
    quantity: data.quantity,
    unit: ingredient.unit,
    unitCost: data.unitCost || currentAvgCost,
    averageCostAfter: newCost,
    notes: data.reason || data.notes || '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
};

export const createStockExit = async (restaurantId, data, ingredients) => {
  const ingredient = ingredients.find(i => i.id === data.ingredientId);
  if (!ingredient) throw new Error('Ingrediente não encontrado');

  const currentQty = ingredient.currentStock || 0;
  if (data.quantity > currentQty) {
    throw new Error(`Estoque insuficiente. Disponível: ${currentQty} ${ingredient.unit}`);
  }

  const newStock = currentQty - data.quantity;

  await updateDoc(doc(db, 'restaurants', restaurantId, 'ingredients', data.ingredientId), {
    currentStock: newStock,
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
    type: 'out',
    ingredientId: data.ingredientId,
    ingredientName: ingredient.name,
    quantity: data.quantity,
    unit: ingredient.unit,
    unitCost: ingredient.averageCost || ingredient.costPerUnit || 0,
    referenceType: 'adjustment',
    notes: data.reason || data.notes || '',
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

export const registerProduction = async (restaurantId, data, recipes, ingredients) => {
  const recipe = recipes.find(r => r.id === data.recipeId);
  if (!recipe) throw new Error('Receita não encontrada');

  let ingredientsCost = 0;
  const yieldQty = recipe.yieldQuantity || 1;

  const variableCostsTotal = (recipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);

  for (const ri of recipe.ingredients || []) {
    const ing = ingredients.find(i => i.id === ri.ingredientId);
    if (!ing) continue;
    ingredientsCost += (ri.quantity || 0) * (ing.averageCost || ing.costPerUnit || 0);
  }

  const totalCost = (ingredientsCost / yieldQty + variableCostsTotal) * data.quantity;

  const prodRef = await addDoc(collection(db, 'restaurants', restaurantId, 'productions'), {
    recipeId: recipe.id,
    recipeName: recipe.name,
    quantity: data.quantity,
    totalProductionCost: totalCost,
    totalCost,
    costPerUnit: totalCost / data.quantity,
    notes: data.notes || '',
    createdAt: serverTimestamp(),
  });

  const ops = [];
  for (const ri of recipe.ingredients || []) {
    const ing = ingredients.find(i => i.id === ri.ingredientId);
    if (!ing) continue;

    let qty = (ri.quantity || 0) * data.quantity;
    if (ri.unit && ing.unit && ri.unit !== ing.unit && canConvert(ri.unit, ing.unit)) {
      qty = convertUnits(qty, ri.unit, ing.unit);
    }
    const unitCost = ing.averageCost || ing.costPerUnit || 0;
    const newStock = Math.max(0, (ing.currentStock || 0) - qty);

    ops.push(
      updateDoc(doc(db, 'restaurants', restaurantId, 'ingredients', ing.id), {
        currentStock: newStock,
        updatedAt: serverTimestamp(),
      }),
      addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
        type: 'out',
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: qty,
        unit: ing.unit,
        unitCost,
        referenceType: 'production',
        referenceId: prodRef.id,
        notes: `Produção: ${recipe.name} (${data.quantity} porç${data.quantity > 1 ? 'ões' : 'ão'})`,
        createdAt: serverTimestamp(),
      })
    );
  }

  await Promise.all(ops);
  return { id: prodRef.id, recipeName: recipe.name, totalCost };
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
    totalCost: filtered.reduce((s, p) => s + (p.totalCost || p.totalProductionCost || 0), 0),
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
  const { restaurantId: _r, ...cleanData } = data;
  const cost = cleanData.cost || cleanData.purchasePrice || 0;
  const salePrice = cleanData.salePrice || 0;
  const profitPerUnit = salePrice - cost;
  const margin = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0;
  const initialStock = cleanData.stockQuantity || cleanData.currentStock || 0;

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'resale_products'), {
    name: cleanData.name,
    cost,
    averageCost: cost,
    salePrice,
    supplierId: cleanData.supplierId || null,
    stockQuantity: initialStock,
    minStock: cleanData.minStock || 0,
    sku: cleanData.sku || '',
    notes: cleanData.notes || '',
    profitPerUnit,
    margin,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (initialStock > 0) {
    await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
      type: 'in',
      resaleProductId: ref.id,
      ingredientName: cleanData.name,
      quantity: initialStock,
      unit: cleanData.unit || 'un',
      unitCost: cost,
      averageCostAfter: cost,
      referenceType: 'adjustment',
      notes: 'Estoque inicial (ajuste de abertura)',
      createdAt: serverTimestamp(),
    });
  }
  return { id: ref.id, ...cleanData, profitPerUnit, margin };
};

export const updateResaleProduct = async (restaurantId, productId, data) => {
  const { restaurantId: _r, ...cleanData } = data;
  const cost = cleanData.cost || cleanData.purchasePrice || 0;
  const salePrice = cleanData.salePrice || 0;
  const profitPerUnit = salePrice - cost;
  const margin = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0;
  await updateDoc(doc(db, 'restaurants', restaurantId, 'resale_products', productId), {
    ...cleanData,
    cost,
    profitPerUnit,
    margin,
    minStock: cleanData.minStock || 0,
    updatedAt: serverTimestamp(),
  });
};

export const createResaleStockEntry = async (restaurantId, data, resaleProducts) => {
  const product = resaleProducts.find(p => p.id === data.productId);
  if (!product) throw new Error('Produto de revenda não encontrado');

  const currentQty = product.stockQuantity || 0;
  const currentAvgCost = product.averageCost || product.cost || 0;
  const newStock = currentQty + data.quantity;

  let newCost;
  if (data.unitCost !== undefined && data.unitCost !== null && data.unitCost > 0) {
    const currentTotalValue = currentQty * currentAvgCost;
    const incomingValue = data.quantity * data.unitCost;
    newCost = newStock > 0 ? (currentTotalValue + incomingValue) / newStock : data.unitCost;
  } else {
    newCost = currentAvgCost;
  }

  await updateDoc(doc(db, 'restaurants', restaurantId, 'resale_products', data.productId), {
    stockQuantity: newStock,
    cost: newCost,
    averageCost: newCost,
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
    type: 'in',
    resaleProductId: data.productId,
    ingredientName: product.name,
    quantity: data.quantity,
    unit: product.unit || 'un',
    unitCost: data.unitCost || currentAvgCost,
    averageCostAfter: newCost,
    referenceType: 'adjustment',
    notes: data.reason || data.notes || '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
};

export const createResaleStockExit = async (restaurantId, data, resaleProducts) => {
  const product = resaleProducts.find(p => p.id === data.productId);
  if (!product) throw new Error('Produto de revenda não encontrado');

  const currentQty = product.stockQuantity || 0;
  if (data.quantity > currentQty) {
    throw new Error(`Estoque insuficiente. Disponível: ${currentQty} ${product.unit || 'un'}`);
  }

  const newStock = currentQty - data.quantity;

  await updateDoc(doc(db, 'restaurants', restaurantId, 'resale_products', data.productId), {
    stockQuantity: newStock,
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
    type: 'out',
    resaleProductId: data.productId,
    ingredientName: product.name,
    quantity: data.quantity,
    unit: product.unit || 'un',
    unitCost: product.averageCost || product.cost || 0,
    referenceType: 'adjustment',
    notes: data.reason || data.notes || '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
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
  const { restaurantId: _r, ...cleanData } = data;
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'menu_items'), {
    ...cleanData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...cleanData };
};

export const updateMenuItem = async (restaurantId, itemId, data) => {
  const { restaurantId: _r, ...cleanData } = data;
  await updateDoc(doc(db, 'restaurants', restaurantId, 'menu_items', itemId), {
    ...cleanData,
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

  let cost = item.cost || item.costPerPortion || 0;

  if (item.itemType === 'recipe' && item.recipeId) {
    const recipeSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'recipes', item.recipeId));
    if (recipeSnap.exists()) {
      const recipe = recipeSnap.data();
      const ingsSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'ingredients'));
      const ingredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const yieldQty = recipe.yieldQuantity || 1;
      let ingsCost = 0;
      for (const ri of recipe.ingredients || []) {
        const ing = ingredients.find(i => i.id === ri.ingredientId);
        if (ing) ingsCost += (ri.quantity || 0) * (ing.averageCost || ing.costPerUnit || 0);
      }
      const variableTotal = (recipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
      cost = ingsCost / yieldQty + variableTotal;
    }
  } else if (item.itemType === 'resale_product' && item.productId) {
    const prodSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'resale_products', item.productId));
    if (prodSnap.exists()) {
      const prod = prodSnap.data();
      cost = prod.averageCost || prod.cost || 0;
    }
  }

  const profit = (salePrice - cost) * data.quantitySold;
  const revenue = salePrice * data.quantitySold;

  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'sales'), {
    itemId: item.id,
    itemName: item.name,
    itemType: item.itemType || 'recipe',
    quantitySold: data.quantitySold,
    totalAmount: revenue,
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
  const [ingredients, resaleProducts, recipes, suppliers, sales, productions] = await Promise.all([
    getIngredients(restaurantId),
    getResaleProducts(restaurantId),
    getRecipes(restaurantId),
    getSuppliers(restaurantId),
    getSales(restaurantId),
    getProductions(restaurantId),
  ]);

  const lowStockAlerts = ingredients.filter(i => (i.currentStock || 0) <= (i.minStock || 0));
  const inventoryValue =
    ingredients.reduce((s, i) => s + (i.currentStock || 0) * (i.averageCost || i.costPerUnit || 0), 0) +
    resaleProducts.reduce((s, p) => s + (p.stockQuantity || p.currentStock || 0) * (p.averageCost || p.cost || 0), 0);

  const now = new Date();
  const todayProductions = productions.filter(p => {
    const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    return d.toDateString() === now.toDateString();
  });
  const todayProductionCost = todayProductions.reduce((s, p) => s + (p.totalCost || p.totalProductionCost || 0), 0);

  const monthSales = sales.filter(s => {
    const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const liveMargins = recipes.map(recipe => {
    const yieldQty = recipe.yieldQuantity || 1;
    let ingsCost = 0;
    for (const ri of recipe.ingredients || []) {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      if (ing) ingsCost += (ri.quantity || 0) * (ing.averageCost || ing.costPerUnit || 0);
    }
    const variableTotal = (recipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
    const costPerPortion = ingsCost / yieldQty + variableTotal;
    const sellingPrice = recipe.sellingPrice || 0;
    return sellingPrice > 0 ? (sellingPrice - costPerPortion) / sellingPrice * 100 : 0;
  });
  const averageMargin = liveMargins.length > 0
    ? liveMargins.reduce((s, m) => s + m, 0) / liveMargins.length
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

// ====================== REPORTS ======================

const filterByPeriod = (items, period, dateField = 'createdAt') => {
  const now = new Date();
  if (period === 'today') {
    return items.filter(i => {
      const d = i[dateField]?.toDate ? i[dateField].toDate() : new Date(i[dateField] || 0);
      return d.toDateString() === now.toDateString();
    });
  }
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return items.filter(i => {
      const d = i[dateField]?.toDate ? i[dateField].toDate() : new Date(i[dateField] || 0);
      return d >= weekAgo;
    });
  }
  if (period === 'month') {
    return items.filter(i => {
      const d = i[dateField]?.toDate ? i[dateField].toDate() : new Date(i[dateField] || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }
  if (period === 'year') {
    return items.filter(i => {
      const d = i[dateField]?.toDate ? i[dateField].toDate() : new Date(i[dateField] || 0);
      return d.getFullYear() === now.getFullYear();
    });
  }
  return items;
};

export const getMenuProfitability = async (restaurantId, period = 'month') => {
  const [menuItems, sales, recipes, resaleProducts] = await Promise.all([
    getMenuItems(restaurantId),
    getSales(restaurantId),
    getRecipes(restaurantId),
    getResaleProducts(restaurantId),
  ]);

  const filteredSales = filterByPeriod(sales, period);

  // Compute average units sold for menu engineering classification
  const itemMap = {};
  for (const sale of filteredSales) {
    const key = sale.itemId;
    if (!itemMap[key]) {
      const menuItem = menuItems.find(m => m.id === key);
      const recipe = menuItem?.recipeId ? recipes.find(r => r.id === menuItem.recipeId) : null;
      const resale = resaleProducts.find(r => r.id === key);
      itemMap[key] = {
        id: key,
        name: sale.itemName || menuItem?.name || 'Item removido',
        category: menuItem?.category || recipe?.category || '',
        revenue: 0,
        cost: 0,
        profit: 0,
        totalProfit: 0,
        unitsSold: 0,
        salePrice: menuItem?.salePrice || sale.salePrice || 0,
        costPerUnit: menuItem?.cost || recipe?.costPerPortion || resale?.cost || sale.cost || 0,
        profitPerUnit: 0,
      };
    }
    itemMap[key].revenue += sale.revenue || 0;
    itemMap[key].cost += (sale.cost || 0) * (sale.quantitySold || 1);
    itemMap[key].profit += sale.profit || 0;
    itemMap[key].totalProfit += sale.profit || 0;
    itemMap[key].unitsSold += sale.quantitySold || 1;
  }

  const avgUnitsSold = Object.values(itemMap).length > 0
    ? Object.values(itemMap).reduce((s, i) => s + i.unitsSold, 0) / Object.values(itemMap).length
    : 0;
  const avgProfit = Object.values(itemMap).length > 0
    ? Object.values(itemMap).reduce((s, i) => s + i.totalProfit, 0) / Object.values(itemMap).length
    : 0;

  const classifyItem = (item) => {
    const highSales = item.unitsSold >= avgUnitsSold;
    const highProfit = item.totalProfit >= avgProfit;
    if (highSales && highProfit) return 'STAR';
    if (highSales && !highProfit) return 'PLOWHORSE';
    if (!highSales && highProfit) return 'PUZZLE';
    return 'DOG';
  };

  const items = Object.values(itemMap).map(item => ({
    ...item,
    margin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0,
    profitPerUnit: item.unitsSold > 0 ? item.totalProfit / item.unitsSold : 0,
    classification: classifyItem(item),
  })).sort((a, b) => b.totalProfit - a.totalProfit);

  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalProfit = items.reduce((s, i) => s + i.totalProfit, 0);
  const totalItemsSold = items.reduce((s, i) => s + i.unitsSold, 0);

  return {
    items,
    summary: { totalRevenue, totalProfit, totalItemsSold },
    totalRevenue,
    totalProfit,
    totalCost: items.reduce((s, i) => s + i.cost, 0),
  };
};

export const getCostReport = async (restaurantId, period = 'month') => {
  const productions = await getProductions(restaurantId);
  const filtered = filterByPeriod(productions, period);

  const byRecipeMap = {};
  for (const p of filtered) {
    const key = p.recipeId;
    if (!byRecipeMap[key]) {
      byRecipeMap[key] = { name: p.recipeName || 'Receita removida', count: 0, totalCost: 0 };
    }
    byRecipeMap[key].count += p.quantity || 1;
    byRecipeMap[key].totalCost += p.totalCost || p.totalProductionCost || 0;
  }

  const byRecipe = Object.values(byRecipeMap).sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalCost: byRecipe.reduce((s, r) => s + r.totalCost, 0),
    productionCount: filtered.length,
    byRecipe,
  };
};

export const getMarginReport = async (restaurantId) => {
  const [recipes, ingredients] = await Promise.all([
    getRecipes(restaurantId),
    getIngredients(restaurantId),
  ]);

  const withPrice = recipes.filter(r => r.sellingPrice > 0).map(r => {
    const yieldQty = r.yieldQuantity || 1;
    let ingsCost = 0;
    for (const ri of r.ingredients || []) {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      if (ing) ingsCost += (ri.quantity || 0) * (ing.averageCost || ing.costPerUnit || 0);
    }
    const variableTotal = (r.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
    const liveCost = ingsCost / yieldQty + variableTotal;
    const sellingPrice = r.sellingPrice || 0;
    const profit = sellingPrice - liveCost;
    const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    return { name: r.name, category: r.category || '', cost: liveCost, sellingPrice, profit, margin };
  });

  const averageMargin = withPrice.length > 0
    ? withPrice.reduce((s, r) => s + r.margin, 0) / withPrice.length
    : 0;

  const distribution = {
    negative: withPrice.filter(r => r.margin < 0).length,
    low: withPrice.filter(r => r.margin >= 0 && r.margin < 20).length,
    medium: withPrice.filter(r => r.margin >= 20 && r.margin < 40).length,
    good: withPrice.filter(r => r.margin >= 40 && r.margin < 60).length,
    excellent: withPrice.filter(r => r.margin >= 60).length,
  };

  return { recipes: withPrice, averageMargin, distribution };
};

// ====================== INVOICES / COMPRAS ======================

export const createInvoice = async (restaurantId, data) => {
  const ref = await addDoc(collection(db, 'restaurants', restaurantId, 'invoices'), {
    supplierId: data.supplierId || null,
    supplierNameSnapshot: data.supplierNameSnapshot || '',
    supplierNameDetected: data.supplierNameDetected || '',
    invoiceNumber: data.invoiceNumber || '',
    invoiceDate: data.invoiceDate || '',
    currency: data.currency || 'BRL',
    totalAmount: data.totalAmount || 0,
    fileUrl: data.fileUrl || '',
    fileType: data.fileType || '',
    extractedJson: data.extractedJson || null,
    confirmedJson: data.confirmedJson || null,
    status: data.status || 'draft',
    uploadedBy: data.uploadedBy || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
};

export const updateInvoice = async (restaurantId, invoiceId, data) => {
  await updateDoc(doc(db, 'restaurants', restaurantId, 'invoices', invoiceId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const getInvoices = async (restaurantId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'invoices'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getInvoicesBySupplier = async (restaurantId, supplierId) => {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'invoices'),
    where('supplierId', '==', supplierId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const checkDuplicateInvoice = async (restaurantId, supplierId, invoiceNumber, invoiceDate, totalAmount) => {
  if (!supplierId) return null;

  if (invoiceNumber) {
    const q = query(
      collection(db, 'restaurants', restaurantId, 'invoices'),
      where('supplierId', '==', supplierId),
      where('invoiceNumber', '==', invoiceNumber)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.status !== 'cancelled') {
        return { id: d.id, invoiceNumber: data.invoiceNumber, invoiceDate: data.invoiceDate, totalAmount: data.totalAmount, matchType: 'number' };
      }
    }
  }

  if (invoiceDate && totalAmount > 0) {
    const q = query(
      collection(db, 'restaurants', restaurantId, 'invoices'),
      where('supplierId', '==', supplierId),
      where('invoiceDate', '==', invoiceDate)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.status !== 'cancelled' && Math.abs((data.totalAmount || 0) - totalAmount) < 0.02) {
        return { id: d.id, invoiceNumber: data.invoiceNumber, invoiceDate: data.invoiceDate, totalAmount: data.totalAmount, matchType: 'date_amount' };
      }
    }
  }

  return null;
};

export const deleteInvoiceWithStockReversal = async (restaurantId, invoiceId) => {
  const movQ = query(
    collection(db, 'restaurants', restaurantId, 'stock_movements'),
    where('invoiceId', '==', invoiceId)
  );
  const movSnap = await getDocs(movQ);
  const movements = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (const mov of movements) {
    const qty = mov.quantity || 0;
    const unitCost = mov.unitCost || 0;

    if (mov.ingredientId) {
      const ref = doc(db, 'restaurants', restaurantId, 'ingredients', mov.ingredientId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const currentQty = data.currentStock || 0;
        const currentAvg = data.averageCost || data.costPerUnit || 0;
        const newQty = Math.max(0, currentQty - qty);
        const removedValue = qty * unitCost;
        const currentTotalValue = currentQty * currentAvg;
        const newTotalValue = Math.max(0, currentTotalValue - removedValue);
        const newAvg = newQty > 0 ? newTotalValue / newQty : currentAvg;
        await updateDoc(ref, { currentStock: newQty, costPerUnit: newAvg, averageCost: newAvg, updatedAt: serverTimestamp() });
      }
    } else if (mov.resaleProductId) {
      const ref = doc(db, 'restaurants', restaurantId, 'resale_products', mov.resaleProductId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const currentQty = data.stockQuantity || 0;
        const currentAvg = data.averageCost || data.cost || 0;
        const newQty = Math.max(0, currentQty - qty);
        const removedValue = qty * unitCost;
        const currentTotalValue = currentQty * currentAvg;
        const newTotalValue = Math.max(0, currentTotalValue - removedValue);
        const newAvg = newQty > 0 ? newTotalValue / newQty : currentAvg;
        await updateDoc(ref, { stockQuantity: newQty, cost: newAvg, averageCost: newAvg, updatedAt: serverTimestamp() });
      }
    }

    await deleteDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', mov.id));
  }

  await deleteDoc(doc(db, 'restaurants', restaurantId, 'invoices', invoiceId));
};

// ─── ATOMIC INVOICE IMPORT ───────────────────────────────────────────────────
// Imports all stock lines in a single Firestore WriteBatch (atomic).
// workingLines must already have linkedItemId resolved for all stock items.
// ignoredLines = items with itemType 'ignore'.
// Returns { confirmedLines, stockImportedValue, ignoredValue, discrepancy }.
export const confirmInvoiceAtomic = async (restaurantId, invoiceId, workingLines, totalInvoiceAmount) => {
  const stockLines = workingLines.filter(
    l => (l.itemType === 'ingredient' || l.itemType === 'resale_product') && l.linkedItemId,
  );
  const nonStockLines = workingLines.filter(
    l => !stockLines.includes(l),
  );

  // Read all current stock docs in parallel
  const snapshots = await Promise.all(
    stockLines.map(line => {
      const colName = line.itemType === 'ingredient' ? 'ingredients' : 'resale_products';
      return getDoc(doc(db, 'restaurants', restaurantId, colName, line.linkedItemId));
    }),
  );

  const batch = writeBatch(db);
  const confirmedLines = [];
  let stockImportedValue = 0;
  let ignoredValue = 0;

  // Process each stock line
  for (let i = 0; i < stockLines.length; i++) {
    const line = stockLines[i];
    const snap = snapshots[i];

    if (!snap.exists()) {
      confirmedLines.push({ ...line, status: 'error', error: 'Item não encontrado' });
      continue;
    }

    const current = snap.data();
    const qty = parseFloat(line.quantity) || 0;
    const unitPrice = parseFloat(line.unitPrice) || 0;
    const lineTotal = parseFloat(line.lineTotal) || Math.round(qty * unitPrice * 1000) / 1000;

    if (line.itemType === 'ingredient') {
      const currentQty = current.currentStock || 0;
      const currentAvg = current.averageCost || current.costPerUnit || 0;
      const newTotalValue = currentQty * currentAvg + lineTotal;
      const newQty = currentQty + qty;
      const newAvg = newQty > 0 ? newTotalValue / newQty : unitPrice;

      batch.update(
        doc(db, 'restaurants', restaurantId, 'ingredients', line.linkedItemId),
        { currentStock: newQty, costPerUnit: newAvg, averageCost: newAvg, updatedAt: serverTimestamp() },
      );

      const movRef = doc(collection(db, 'restaurants', restaurantId, 'stock_movements'));
      batch.set(movRef, {
        type: 'in',
        ingredientId: line.linkedItemId,
        ingredientName: current.name,
        quantity: qty,
        unit: line.unit || current.unit || '',
        unitCost: unitPrice,
        averageCostAfter: newAvg,
        invoiceId,
        referenceType: 'invoice',
        referenceId: invoiceId,
        notes: `Importado da nota fiscal — ${line.rawDescription || line.confirmedName || line.suggestedName || ''}`,
        createdAt: serverTimestamp(),
      });

      confirmedLines.push({
        ...line,
        status: 'imported',
        qty,
        unitPrice,
        lineTotal,
        addedToStock: `+${qty} ${line.unit || current.unit || 'un'}`,
        newAvgCost: newAvg,
      });
      stockImportedValue += lineTotal;
    } else if (line.itemType === 'resale_product') {
      const currentQty = current.stockQuantity || 0;
      const currentAvg = current.averageCost || current.cost || 0;
      const newTotalValue = currentQty * currentAvg + lineTotal;
      const newQty = currentQty + qty;
      const newAvg = newQty > 0 ? newTotalValue / newQty : unitPrice;

      batch.update(
        doc(db, 'restaurants', restaurantId, 'resale_products', line.linkedItemId),
        { stockQuantity: newQty, cost: newAvg, averageCost: newAvg, updatedAt: serverTimestamp() },
      );

      const movRef = doc(collection(db, 'restaurants', restaurantId, 'stock_movements'));
      batch.set(movRef, {
        type: 'in',
        resaleProductId: line.linkedItemId,
        ingredientName: current.name,
        quantity: qty,
        unit: line.unit || '',
        unitCost: unitPrice,
        averageCostAfter: newAvg,
        invoiceId,
        referenceType: 'invoice',
        referenceId: invoiceId,
        notes: `Importado da nota fiscal — ${line.rawDescription || line.confirmedName || line.suggestedName || ''}`,
        createdAt: serverTimestamp(),
      });

      confirmedLines.push({
        ...line,
        status: 'imported',
        qty,
        unitPrice,
        lineTotal,
        addedToStock: `+${qty} ${line.unit || 'un'}`,
        newAvgCost: newAvg,
      });
      stockImportedValue += lineTotal;
    }
  }

  // Non-stock lines (ignored, skipped, error)
  for (const line of nonStockLines) {
    const lt = parseFloat(line.lineTotal) || 0;
    const status = line.itemType === 'ignore' ? 'ignored' : 'skipped';
    confirmedLines.push({ ...line, status });
    ignoredValue += lt;
  }

  const discrepancy = Math.round(((totalInvoiceAmount || 0) - stockImportedValue - ignoredValue) * 100) / 100;
  const hasErrors = confirmedLines.some(l => l.status === 'error');
  const status = hasErrors ? 'with_divergence' : 'imported';

  batch.update(
    doc(db, 'restaurants', restaurantId, 'invoices', invoiceId),
    {
      confirmedJson: { items: confirmedLines },
      stockImportedValue,
      ignoredValue,
      discrepancy,
      status,
      updatedAt: serverTimestamp(),
    },
  );

  await batch.commit();

  return { confirmedLines, stockImportedValue, ignoredValue, discrepancy, status };
};

// Weighted average cost update when importing an invoice line to stock
export const importInvoiceLineToStock = async (restaurantId, invoiceId, line) => {
  const { linkedItemId, itemType, confirmedName, quantity, unit, unitPrice, lineTotal, rawDescription } = line;

  if (!linkedItemId || itemType === 'ignore' || itemType === 'unknown') return;

  if (itemType === 'ingredient') {
    const ingRef = doc(db, 'restaurants', restaurantId, 'ingredients', linkedItemId);
    const snap = await getDoc(ingRef);
    if (!snap.exists()) return;
    const current = snap.data();

    const currentQty = current.currentStock || 0;
    const currentAvgCost = current.averageCost || current.costPerUnit || 0;
    const currentTotalValue = currentQty * currentAvgCost;

    const purchaseValue = lineTotal || quantity * unitPrice || 0;
    const newTotalValue = currentTotalValue + purchaseValue;
    const newTotalQty = currentQty + quantity;
    const newAvgCost = newTotalQty > 0 ? newTotalValue / newTotalQty : unitPrice;

    await updateDoc(ingRef, {
      currentStock: newTotalQty,
      costPerUnit: newAvgCost,
      averageCost: newAvgCost,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
      type: 'in',
      ingredientId: linkedItemId,
      ingredientName: current.name,
      quantity,
      unit: unit || current.unit,
      unitCost: unitPrice,
      averageCostAfter: newAvgCost,
      invoiceId,
      notes: `Importado da nota fiscal — ${rawDescription || confirmedName || ''}`,
      createdAt: serverTimestamp(),
    });
  }

  if (itemType === 'resale_product') {
    const prodRef = doc(db, 'restaurants', restaurantId, 'resale_products', linkedItemId);
    const snap = await getDoc(prodRef);
    if (!snap.exists()) return;
    const current = snap.data();

    const currentQty = current.stockQuantity || 0;
    const currentAvgCost = current.averageCost || current.cost || 0;
    const currentTotalValue = currentQty * currentAvgCost;

    const purchaseValue = lineTotal || quantity * unitPrice || 0;
    const newTotalValue = currentTotalValue + purchaseValue;
    const newTotalQty = currentQty + quantity;
    const newAvgCost = newTotalQty > 0 ? newTotalValue / newTotalQty : unitPrice;

    await updateDoc(prodRef, {
      stockQuantity: newTotalQty,
      cost: newAvgCost,
      averageCost: newAvgCost,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'restaurants', restaurantId, 'stock_movements'), {
      type: 'in',
      resaleProductId: linkedItemId,
      ingredientName: current.name,
      quantity,
      unit: unit || '',
      unitCost: unitPrice,
      averageCostAfter: newAvgCost,
      invoiceId,
      notes: `Importado da nota fiscal — ${rawDescription || confirmedName || ''}`,
      createdAt: serverTimestamp(),
    });
  }
};
