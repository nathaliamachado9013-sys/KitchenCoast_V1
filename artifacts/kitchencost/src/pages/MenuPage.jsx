import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, getRecipes, getResaleProducts, getMenuCategories, createMenuCategory, getIngredients } from '../lib/firestore';
import { formatCurrency, formatNumber, canConvert, convertUnits } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Pencil, Trash2, UtensilsCrossed, TrendingUp, Search, Zap } from 'lucide-react';

const MenuPage = () => {
  const { restaurant, currency } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [resaleProducts, setResaleProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const emptyForm = { name: '', description: '', itemType: 'recipe', recipeId: '', productId: '', salePrice: '', category: '', isAvailable: true };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const [items, recs, resale, ings, cats] = await Promise.all([
        getMenuItems(restaurant.restaurantId),
        getRecipes(restaurant.restaurantId),
        getResaleProducts(restaurant.restaurantId),
        getIngredients(restaurant.restaurantId),
        getMenuCategories(restaurant.restaurantId),
      ]);
      setMenuItems(items); setRecipes(recs); setResaleProducts(resale); setIngredients(ings); setCategories(cats);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar cardápio', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const filtered = menuItems.filter(i => {
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openModal = (item = null) => {
    const useSuggested = item?._useSuggested;
    const cleanItem = item ? { ...item } : null;
    if (cleanItem) delete cleanItem._useSuggested;
    setEditingItem(cleanItem);
    if (cleanItem) {
      let salePrice = cleanItem.salePrice?.toString() || '';
      if (useSuggested && cleanItem.itemType === 'recipe' && cleanItem.recipeId) {
        const recipe = recipes.find(r => r.id === cleanItem.recipeId);
        if (recipe?.sellingPrice) salePrice = recipe.sellingPrice.toString();
      }
      setFormData({ name: cleanItem.name, description: cleanItem.description || '', itemType: cleanItem.itemType || 'recipe', recipeId: cleanItem.recipeId || '', productId: cleanItem.productId || '', salePrice, category: cleanItem.category || '', isAvailable: cleanItem.isAvailable !== false });
    } else {
      setFormData(emptyForm);
    }
    setModalOpen(true);
  };

  const handleItemTypeChange = (type) => {
    setFormData({ ...formData, itemType: type, recipeId: '', productId: '', salePrice: '', name: formData.name });
  };

  const handleRecipeSelect = (recipeId) => {
    const recipe = recipes.find(r => r.id === recipeId);
    setFormData(prev => ({ ...prev, recipeId, name: prev.name || recipe?.name || '', salePrice: recipe?.sellingPrice?.toString() || '' }));
  };

  const handleProductSelect = (productId) => {
    const product = resaleProducts.find(p => p.id === productId);
    setFormData(prev => ({ ...prev, productId, name: prev.name || product?.name || '', salePrice: product?.salePrice?.toString() || '' }));
  };

  const getItemCost = (item) => {
    if (item.itemType === 'recipe') {
      const recipe = recipes.find(r => r.id === item.recipeId);
      if (!recipe) return item.cost || 0;
      // Live cost from current ingredient prices (not cached costPerPortion)
      const yieldQty = recipe.yieldQuantity || 1;
      let ingsCost = 0;
      for (const ri of recipe.ingredients || []) {
        const ing = ingredients.find(i => i.id === ri.ingredientId);
        if (!ing) continue;
        let qty = ri.quantity || 0;
        if (ri.unit && ing.unit && ri.unit !== ing.unit && canConvert(ri.unit, ing.unit)) {
          qty = convertUnits(qty, ri.unit, ing.unit);
        }
        ingsCost += qty * (ing.averageCost || ing.costPerUnit || 0);
      }
      const variableTotal = (recipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
      return ingsCost / yieldQty + variableTotal;
    } else {
      const product = resaleProducts.find(p => p.id === item.productId);
      return product?.averageCost || product?.cost || item.cost || 0;
    }
  };

  // Ideal price = sellingPrice set in recipe (calculated from desiredMargin)
  const getIdealPrice = (item) => {
    if (item.itemType === 'recipe') {
      const recipe = recipes.find(r => r.id === item.recipeId);
      return recipe?.sellingPrice || null;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let cost = 0;
      if (formData.itemType === 'recipe') {
        // Store live cost (same calculation as getItemCost / liveRecipeCosts)
        cost = getItemCost({ itemType: 'recipe', recipeId: formData.recipeId });
      } else {
        const product = resaleProducts.find(p => p.id === formData.productId);
        cost = product?.averageCost || product?.cost || 0;
      }
      const data = { name: formData.name, description: formData.description, itemType: formData.itemType, recipeId: formData.recipeId || null, productId: formData.productId || null, salePrice: parseFloat(formData.salePrice) || 0, cost, category: formData.category || '', isAvailable: formData.isAvailable };
      if (editingItem) { await updateMenuItem(restaurant.restaurantId, editingItem.id, data); toast({ title: 'Item atualizado!' }); }
      else { await createMenuItem(restaurant.restaurantId, data); toast({ title: 'Item adicionado!' }); }
      setModalOpen(false); loadData();
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Remover "${item.name}" do cardápio?`)) return;
    try { await deleteMenuItem(restaurant.restaurantId, item.id); toast({ title: 'Item removido!' }); loadData(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const handleNewCategory = async () => {
    if (!newCatName.trim()) return;
    try { await createMenuCategory(restaurant.restaurantId, newCatName.trim()); setNewCatModal(false); setNewCatName(''); loadData(); toast({ title: 'Categoria criada!' }); }
    catch { toast({ title: 'Erro', description: 'Erro ao criar categoria', variant: 'destructive' }); }
  };

  const marginColor = (m) => m < 0 ? 'text-red-600' : m < 20 ? 'text-amber-600' : 'text-green-600';

  const getMargin = (item) => {
    const cost = getItemCost(item);
    const sale = item.salePrice || 0;
    if (!sale) return 0;
    return ((sale - cost) / sale) * 100;
  };

  const byCategory = categories.length > 0
    ? categories.reduce((acc, cat) => {
        const items = filtered.filter(i => i.category === cat.name);
        if (items.length > 0) acc[cat.name] = items;
        return acc;
      }, { 'Sem categoria': filtered.filter(i => !i.category || !categories.find(c => c.name === i.category)) })
    : { 'Todos os itens': filtered };

  return (
    <Layout title="Cardápio" actions={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setNewCatModal(true)}><Plus className="w-4 h-4 mr-2" />Nova Categoria</Button>
        <Button size="sm" onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" />Novo Item</Button>
      </div>
    }>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum item no cardápio</p>
          <Button onClick={() => openModal()} className="mt-4" size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar primeiro item</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byCategory).filter(([, items]) => items.length > 0).map(([catName, items]) => (
            <div key={catName}>
              <h3 className="font-semibold text-muted-foreground uppercase text-xs tracking-wider mb-3">{catName}</h3>
              <div className="bg-card rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Custo</th>
                      <th className="px-4 py-3 font-semibold">Preço Ideal</th>
                      <th className="px-4 py-3 font-semibold">Preço Praticado</th>
                      <th className="px-4 py-3 font-semibold">Margem</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const cost = getItemCost(item);
                      const idealPrice = getIdealPrice(item);
                      const margin = getMargin(item);
                      const priceMatchesIdeal = idealPrice !== null && Math.abs((item.salePrice || 0) - idealPrice) < 0.005;
                      return (
                        <tr key={item.id} className="border-t border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.name}</div>
                            {item.description && <div className="text-xs text-muted-foreground truncate max-w-48">{item.description}</div>}
                          </td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${item.itemType === 'recipe' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>{item.itemType === 'recipe' ? 'Receita' : 'Revenda'}</span></td>
                          <td className="px-4 py-3 text-muted-foreground">{formatCurrency(cost, currency)}</td>
                          <td className="px-4 py-3">
                            {idealPrice !== null ? (
                              <span className="text-blue-600 font-medium">{formatCurrency(idealPrice, currency)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(item.salePrice || 0, currency)}</span>
                              {idealPrice !== null && !priceMatchesIdeal && (
                                <button
                                  title="Usar preço sugerido da ficha técnica"
                                  className="text-blue-500 hover:text-blue-700 transition-colors"
                                  onClick={() => openModal({ ...item, _useSuggested: true })}
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className={`font-semibold ${marginColor(margin)}`}>{formatNumber(margin, 1)}%</span></td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${item.isAvailable !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isAvailable !== false ? 'Disponível' : 'Indisponível'}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(item)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item no Cardápio'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label>Tipo de item</Label>
              <Select value={formData.itemType} onValueChange={handleItemTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recipe">Receita (ficha técnica)</SelectItem>
                  <SelectItem value="resale_product">Produto de Revenda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.itemType === 'recipe' && (
              <div>
                <Label>Receita</Label>
                <Select value={formData.recipeId || 'none'} onValueChange={(v) => v !== 'none' && handleRecipeSelect(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a receita" /></SelectTrigger>
                  <SelectContent>{recipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {formData.itemType === 'resale_product' && (
              <div>
                <Label>Produto</Label>
                <Select value={formData.productId || 'none'} onValueChange={(v) => v !== 'none' && handleProductSelect(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>{resaleProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Nome no cardápio *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div><Label>Descrição</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            {formData.itemType === 'recipe' && formData.recipeId && (() => {
              const recipe = recipes.find(r => r.id === formData.recipeId);
              const idealPrice = recipe?.sellingPrice;
              if (!idealPrice) return null;
              return (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                  <span className="text-blue-700">Preço ideal da ficha: <strong>{formatCurrency(idealPrice, currency)}</strong></span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    onClick={() => setFormData(prev => ({ ...prev, salePrice: idealPrice.toString() }))}
                  >
                    <Zap className="w-3 h-3" />Usar preço sugerido
                  </button>
                </div>
              );
            })()}
            <div className="form-grid">
              <div><Label>Preço praticado</Label><Input type="number" step="0.01" value={formData.salePrice} onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={formData.category || 'none'} onValueChange={(v) => setFormData({ ...formData, category: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="available" checked={formData.isAvailable} onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })} className="rounded" />
              <Label htmlFor="available">Disponível no cardápio</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingItem ? 'Salvar' : 'Adicionar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newCatModal} onOpenChange={setNewCatModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Nome da categoria</Label><Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ex: Pratos Principais" /></div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setNewCatModal(false)}>Cancelar</Button>
              <Button onClick={handleNewCategory}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MenuPage;
