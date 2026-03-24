import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe, getIngredients, getOperationalCosts } from '../lib/firestore';
import { formatCurrency, formatNumber, RECIPE_CATEGORIES, MARGIN_RECOMMENDATIONS, UNITS, canConvert, convertUnits } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Pencil, Trash2, BookOpen, AlertTriangle, Search, X } from 'lucide-react';

const emptyForm = { name: '', description: '', category: '', yieldQuantity: '1', yieldUnit: 'porção', sellingPrice: '', desiredMargin: '', preparationTime: '', instructions: '', ingredients: [], variableCosts: [] };

const RecipesPage = () => {
  const { restaurant, currency } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [opCosts, setOpCosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { toast } = useToast();

  const [ingSearch, setIngSearch] = useState('');
  const [selectedIng, setSelectedIng] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('g');

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const [r, i, costs] = await Promise.all([
        getRecipes(restaurant.restaurantId),
        getIngredients(restaurant.restaurantId),
        getOperationalCosts(restaurant.restaurantId),
      ]);
      setRecipes(r); setIngredients(i); setOpCosts(costs);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar receitas', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const opCostPerDish = useMemo(() => {
    if (!opCosts) return 0;
    const total = (opCosts.rent || 0) + (opCosts.electricity || 0) + (opCosts.water || 0) + (opCosts.internet || 0) + (opCosts.salaries || 0) + (opCosts.accounting || 0) + (opCosts.taxes || 0) + (opCosts.otherCosts || 0);
    return total / (opCosts.averageDishesPerMonth || 1);
  }, [opCosts]);

  const pricing = useMemo(() => {
    const yieldQty = parseFloat(formData.yieldQuantity) || 1;
    let ingsCost = 0;
    for (const ri of formData.ingredients) {
      const ing = ingredients.find(i => i.id === ri.ingredientId);
      if (!ing) continue;
      let qty = ri.quantity || 0;
      if (ri.unit && ing.unit && ri.unit !== ing.unit && canConvert(ri.unit, ing.unit)) {
        qty = convertUnits(qty, ri.unit, ing.unit);
      }
      ingsCost += qty * (ing.averageCost || ing.costPerUnit || 0);
    }
    const variableTotal = (formData.variableCosts || []).reduce((s, v) => s + (parseFloat(v.value) || 0), 0);
    const totalDishCost = ingsCost / yieldQty + variableTotal + opCostPerDish;
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    const profitPerUnit = sellingPrice - totalDishCost;
    const actualMargin = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
    const desiredMarginDec = (parseFloat(formData.desiredMargin) || 0) / 100;
    const suggestedPrice = desiredMarginDec > 0 && desiredMarginDec < 1 ? totalDishCost / (1 - desiredMarginDec) : 0;
    const category = formData.category || 'Outros';
    const rec = MARGIN_RECOMMENDATIONS[category] || MARGIN_RECOMMENDATIONS['Outros'];
    return { totalDishCost, ingsCost: ingsCost / yieldQty, variableTotal, sellingPrice, profitPerUnit, actualMargin, suggestedPrice, recommendedRange: rec.label, minRec: rec.min * 100, maxRec: rec.max * 100 };
  }, [formData, ingredients, opCostPerDish]);

  const liveRecipeCosts = useMemo(() => {
    const map = {};
    for (const recipe of recipes) {
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
      const costPerPortion = ingsCost / yieldQty + variableTotal + opCostPerDish;
      const sellingPrice = recipe.sellingPrice || 0;
      const profitPerUnit = sellingPrice - costPerPortion;
      const margin = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
      map[recipe.id] = { costPerPortion, profitPerUnit, margin };
    }
    return map;
  }, [recipes, ingredients, opCostPerDish]);

  const filtered = recipes.filter(r => {
    const matchSearch = !search || r.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({ name: item.name || '', description: item.description || '', category: item.category || '', yieldQuantity: item.yieldQuantity?.toString() || '1', yieldUnit: item.yieldUnit || 'porção', sellingPrice: item.sellingPrice?.toString() || '', desiredMargin: item.desiredMargin ? (item.desiredMargin * 100).toString() : '', preparationTime: item.preparationTime?.toString() || '', instructions: item.instructions || '', ingredients: item.ingredients || [], variableCosts: item.variableCosts || [] });
    } else {
      setFormData(emptyForm);
    }
    setModalOpen(true);
  };

  const addIngredient = () => {
    if (!selectedIng || !ingQty) return;
    const ing = ingredients.find(i => i.id === selectedIng);
    if (!ing) return;
    setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, { ingredientId: ing.id, ingredientName: ing.name, quantity: parseFloat(ingQty), unit: ingUnit || ing.unit }] }));
    setSelectedIng(''); setIngQty(''); setIngSearch('');
  };

  const removeIngredient = (idx) => setFormData(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }));

  const addVariableCost = () => setFormData(prev => ({ ...prev, variableCosts: [...prev.variableCosts, { name: '', value: 0 }] }));
  const removeVariableCost = (idx) => setFormData(prev => ({ ...prev, variableCosts: prev.variableCosts.filter((_, i) => i !== idx) }));
  const updateVariableCost = (idx, field, value) => setFormData(prev => ({ ...prev, variableCosts: prev.variableCosts.map((v, i) => i === idx ? { ...v, [field]: field === 'value' ? parseFloat(value) || 0 : value } : v) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const data = { name: formData.name, description: formData.description, category: formData.category, yieldQuantity: parseFloat(formData.yieldQuantity) || 1, yieldUnit: formData.yieldUnit, sellingPrice: parseFloat(formData.sellingPrice) || 0, desiredMargin: (parseFloat(formData.desiredMargin) || 0) / 100, preparationTime: parseFloat(formData.preparationTime) || 0, instructions: formData.instructions, ingredients: formData.ingredients, variableCosts: formData.variableCosts };
      if (editingItem) { await updateRecipe(restaurant.restaurantId, editingItem.id, data, ingredients, opCostPerDish); toast({ title: 'Receita atualizada!' }); }
      else { await createRecipe(restaurant.restaurantId, data, ingredients, opCostPerDish); toast({ title: 'Receita criada!' }); }
      setModalOpen(false); loadData();
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar receita', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try { await deleteRecipe(restaurant.restaurantId, item.id); toast({ title: 'Receita excluída!' }); loadData(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const marginColor = (m) => m < 0 ? 'text-red-600' : m < 20 ? 'text-amber-600' : m < 40 ? 'text-blue-600' : 'text-green-600';

  const filteredIngs = ingredients.filter(i => !ingSearch || i.name?.toLowerCase().includes(ingSearch.toLowerCase()));

  return (
    <Layout title="Fichas Técnicas" actions={<Button onClick={() => openModal()} size="sm"><Plus className="w-4 h-4 mr-2" />Nova Receita</Button>}>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar receita..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {RECIPE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma receita encontrada</p>
              <Button onClick={() => openModal()} className="mt-4" size="sm"><Plus className="w-4 h-4 mr-2" />Criar primeira receita</Button>
            </div>
          ) : filtered.map(recipe => (
            <div key={recipe.id} className="stat-card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{recipe.name}</h3>
                  {recipe.category && <span className="text-xs text-muted-foreground">{recipe.category}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal(recipe)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(recipe)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              {(() => {
                const live = liveRecipeCosts[recipe.id] || {};
                const liveCost = live.costPerPortion ?? recipe.costPerPortion ?? 0;
                const liveProfit = live.profitPerUnit ?? recipe.profitPerUnit ?? 0;
                const liveMargin = live.margin ?? recipe.margin ?? 0;
                return (
                  <div className="space-y-1 text-sm mt-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo/porção</span><span className="font-medium">{formatCurrency(liveCost, currency)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Preço de venda</span><span className="font-medium">{formatCurrency(recipe.sellingPrice || 0, currency)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><span className={`font-semibold ${marginColor(liveMargin)}`}>{formatNumber(liveMargin, 1)}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Lucro/porção</span><span className="font-medium text-emerald-600">{formatCurrency(liveProfit, currency)}</span></div>
                  </div>
                );
              })()}
              {recipe.ingredients?.length > 0 && <p className="text-xs text-muted-foreground mt-2">{recipe.ingredients.length} ingrediente(s)</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Receita' : 'Nova Receita'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">Informações</TabsTrigger>
                <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
                <TabsTrigger value="pricing">Precificação</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                <div><Label>Descrição</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                <div className="form-grid">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={formData.category || 'none'} onValueChange={(v) => setFormData({ ...formData, category: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {RECIPE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Tempo de preparo (min)</Label><Input type="number" value={formData.preparationTime} onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })} /></div>
                </div>
                <div className="form-grid">
                  <div><Label>Rendimento (quantidade)</Label><Input type="number" step="0.1" value={formData.yieldQuantity} onChange={(e) => setFormData({ ...formData, yieldQuantity: e.target.value })} /></div>
                  <div><Label>Unidade de rendimento</Label><Input value={formData.yieldUnit} onChange={(e) => setFormData({ ...formData, yieldUnit: e.target.value })} placeholder="porção, unidade..." /></div>
                </div>
                <div><Label>Modo de Preparo</Label><Textarea rows={4} value={formData.instructions} onChange={(e) => setFormData({ ...formData, instructions: e.target.value })} placeholder="Passo a passo..." /></div>
              </TabsContent>

              <TabsContent value="ingredients" className="space-y-4 pt-4">
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm">Adicionar ingrediente</h4>
                  <div>
                    <Input placeholder="Buscar ingrediente..." value={ingSearch} onChange={(e) => { setIngSearch(e.target.value); setSelectedIng(''); }} />
                    {ingSearch && (
                      <div className="border rounded-lg mt-1 max-h-36 overflow-y-auto bg-card shadow-sm">
                        {filteredIngs.slice(0, 10).map(i => (
                          <button type="button" key={i.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between" onClick={() => { setSelectedIng(i.id); setIngUnit(i.unit); setIngSearch(i.name); }}>
                            <span>{i.name}</span><span className="text-muted-foreground">{formatCurrency(i.costPerUnit, currency)}/{i.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" step="0.001" placeholder="Qtd" className="w-28" value={ingQty} onChange={(e) => setIngQty(e.target.value)} />
                    <Select value={ingUnit} onValueChange={setIngUnit}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={addIngredient} disabled={!selectedIng || !ingQty}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
                  </div>
                </div>
                {formData.ingredients.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum ingrediente adicionado ainda</p> : (
                  <div className="space-y-2">
                    {formData.ingredients.map((ri, idx) => {
                      const ing = ingredients.find(i => i.id === ri.ingredientId);
                      const cost = (ri.quantity || 0) * (ing?.averageCost || ing?.costPerUnit || 0);
                      return (
                        <div key={idx} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                          <span className="font-medium text-sm">{ri.ingredientName || ing?.name}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{ri.quantity} {ri.unit}</span>
                            <span className="font-medium">{formatCurrency(cost, currency)}</span>
                            <Button type="button" variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => removeIngredient(idx)}><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Custos variáveis</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addVariableCost}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar</Button>
                  </div>
                  {formData.variableCosts.map((vc, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <Input placeholder="Descrição" value={vc.name} onChange={(e) => updateVariableCost(idx, 'name', e.target.value)} />
                      <Input type="number" step="0.01" placeholder="Valor" className="w-32" value={vc.value} onChange={(e) => updateVariableCost(idx, 'value', e.target.value)} />
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeVariableCost(idx)}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 pt-4">
                <div className="form-grid">
                  <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })} /></div>
                  <div><Label>Margem desejada (%)</Label><Input type="number" step="0.1" value={formData.desiredMargin} onChange={(e) => setFormData({ ...formData, desiredMargin: e.target.value })} /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo de ingredientes</span><span>{formatCurrency(pricing.ingsCost, currency)}</span></div>
                  {pricing.variableTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Custos variáveis</span><span>{formatCurrency(pricing.variableTotal, currency)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo fixo/prato</span><span>{formatCurrency(opCostPerDish, currency)}</span></div>
                  <div className="flex justify-between border-t pt-2 font-medium"><span>Custo total/porção</span><span>{formatCurrency(pricing.totalDishCost, currency)}</span></div>
                  {pricing.suggestedPrice > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Preço sugerido</span><span className="font-medium text-primary">{formatCurrency(pricing.suggestedPrice, currency)}</span></div>}
                  {pricing.sellingPrice > 0 && (
                    <>
                      <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Margem real</span><span className={`font-bold ${marginColor(pricing.actualMargin)}`}>{formatNumber(pricing.actualMargin, 1)}%</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Lucro/porção</span><span className="font-semibold text-emerald-600">{formatCurrency(pricing.profitPerUnit, currency)}</span></div>
                    </>
                  )}
                  <p className="text-muted-foreground text-xs">Margem recomendada: {pricing.recommendedRange}</p>
                  {pricing.sellingPrice > 0 && pricing.actualMargin < pricing.minRec && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-700 p-2 rounded text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Margem abaixo do recomendado. Considere {formatCurrency(pricing.suggestedPrice, currency)} como preço.</span>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingItem ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default RecipesPage;
