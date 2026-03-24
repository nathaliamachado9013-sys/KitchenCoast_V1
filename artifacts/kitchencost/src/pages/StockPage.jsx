import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getIngredients, getResaleProducts, getStockMovements, createStockEntry, createStockExit, createResaleStockEntry, createResaleStockExit, getInventoryValue, createIngredient } from '../lib/firestore';
import { formatCurrency, formatNumber, formatDateTime } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Package, ArrowUpCircle, ArrowDownCircle, AlertTriangle, DollarSign, PlusCircle, X } from 'lucide-react';

const StockPage = () => {
  const { restaurant, currency } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [resaleProducts, setResaleProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('entry');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({ itemType: 'ingredient', itemId: '', quantity: '', unitCost: '', reason: 'compra' });

  // Inline ingredient creation state
  const [showNewIngredientForm, setShowNewIngredientForm] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: '', unit: '' });
  const [creatingIngredient, setCreatingIngredient] = useState(false);

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const rid = restaurant.restaurantId || restaurant.id;
      const [ings, resale, movs, inv] = await Promise.all([
        getIngredients(rid),
        getResaleProducts(rid),
        getStockMovements(rid),
        getInventoryValue(rid),
      ]);
      setIngredients(ings); setResaleProducts(resale); setMovements(movs); setInventoryValue(inv);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar estoque', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const openModal = (type) => {
    setModalType(type);
    setFormData({ itemType: 'ingredient', itemId: '', quantity: '', unitCost: '', reason: type === 'entry' ? 'compra' : 'producao' });
    setShowNewIngredientForm(false);
    setNewIngredient({ name: '', unit: '' });
    setModalOpen(true);
  };

  const handleCreateNewIngredient = async () => {
    if (!newIngredient.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setCreatingIngredient(true);
    try {
      const rid = restaurant.restaurantId || restaurant.id;
      const created = await createIngredient(rid, {
        name: newIngredient.name.trim(),
        unit: newIngredient.unit.trim() || 'un',
        costPerUnit: 0,
        currentStock: 0,
        minStock: 0,
      });
      const updated = [...ingredients, { ...created, id: created.id, name: newIngredient.name.trim(), unit: newIngredient.unit.trim() || 'un', currentStock: 0 }];
      setIngredients(updated);
      setFormData(f => ({ ...f, itemId: created.id }));
      setShowNewIngredientForm(false);
      setNewIngredient({ name: '', unit: '' });
      toast({ title: `Ingrediente "${newIngredient.name.trim()}" criado!` });
    } catch (err) {
      toast({ title: 'Erro ao criar ingrediente', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingIngredient(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemId || !formData.quantity) { toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const rid = restaurant.restaurantId;
      const qty = parseFloat(formData.quantity);
      const unitCost = formData.unitCost ? parseFloat(formData.unitCost) : undefined;
      if (formData.itemType === 'ingredient') {
        if (modalType === 'entry') {
          await createStockEntry(rid, { ingredientId: formData.itemId, quantity: qty, unitCost, reason: formData.reason }, ingredients);
        } else {
          await createStockExit(rid, { ingredientId: formData.itemId, quantity: qty, reason: formData.reason }, ingredients);
        }
      } else {
        if (modalType === 'entry') {
          await createResaleStockEntry(rid, { productId: formData.itemId, quantity: qty, unitCost, reason: formData.reason }, resaleProducts);
        } else {
          await createResaleStockExit(rid, { productId: formData.itemId, quantity: qty, reason: formData.reason }, resaleProducts);
        }
      }
      toast({ title: modalType === 'entry' ? 'Entrada registrada!' : 'Saída registrada!' });
      setModalOpen(false); loadData();
    } catch (err) { toast({ title: 'Erro', description: err.message || 'Erro ao registrar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const getStockStatus = (item) => {
    if ((item.currentStock || 0) <= 0) return { label: 'Crítico', cls: 'bg-red-100 text-red-700' };
    if ((item.currentStock || 0) <= (item.minStock || 0)) return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'OK', cls: 'bg-green-100 text-green-700' };
  };

  return (
    <Layout title="Estoque" actions={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => openModal('exit')}><ArrowDownCircle className="w-4 h-4 mr-2" />Saída</Button>
        <Button size="sm" onClick={() => openModal('entry')}><ArrowUpCircle className="w-4 h-4 mr-2" />Entrada</Button>
      </div>
    }>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-emerald-600" /><span className="text-sm text-muted-foreground">Valor do Inventário</span></div>
          <div className="text-2xl font-bold">{formatCurrency(inventoryValue?.totalValue || 0, currency)}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><Package className="w-5 h-5 text-blue-600" /><span className="text-sm text-muted-foreground">Total de Itens</span></div>
          <div className="text-2xl font-bold">{inventoryValue?.itemCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><AlertTriangle className="w-5 h-5 text-amber-600" /><span className="text-sm text-muted-foreground">Estoque Baixo</span></div>
          <div className="text-2xl font-bold">
            {ingredients.filter(i => (i.currentStock || 0) <= (i.minStock || 0)).length +
             resaleProducts.filter(p => (p.stockQuantity || p.currentStock || 0) <= (p.minStock || 0)).length}
          </div>
        </div>
      </div>

      <Tabs defaultValue="current">
        <TabsList className="mb-4">
          <TabsTrigger value="current">Estoque Atual</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {loading ? <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Estoque Atual</th>
                    <th className="px-4 py-3 font-semibold">Estoque Mínimo</th>
                    <th className="px-4 py-3 font-semibold">Custo Médio/Unid</th>
                    <th className="px-4 py-3 font-semibold">Valor em Estoque</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.length === 0 && resaleProducts.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhum item em estoque</p></td></tr>
                  ) : null}
                  {ingredients.map(item => {
                    const st = getStockStatus(item);
                    const avgCost = item.averageCost || item.costPerUnit || 0;
                    return (
                      <tr key={`ing-${item.id}`} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">Ingrediente</span></td>
                        <td className="px-4 py-3">{formatNumber(item.currentStock || 0)} {item.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatNumber(item.minStock || 0)} {item.unit}</td>
                        <td className="px-4 py-3">{formatCurrency(avgCost, currency)}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency((item.currentStock || 0) * avgCost, currency)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                  {resaleProducts.map(item => {
                    const qty = item.stockQuantity || item.currentStock || 0;
                    const avgCost = item.averageCost || item.cost || 0;
                    const isLow = qty <= (item.minStock || 0);
                    const isCritical = qty <= 0;
                    const st = isCritical
                      ? { label: 'Crítico', cls: 'bg-red-100 text-red-700' }
                      : isLow
                        ? { label: 'Baixo', cls: 'bg-amber-100 text-amber-700' }
                        : { label: 'OK', cls: 'bg-green-100 text-green-700' };
                    return (
                      <tr key={`res-${item.id}`} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700">Revenda</span></td>
                        <td className="px-4 py-3">{formatNumber(qty)} {item.unit || 'un'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatNumber(item.minStock || 0)} {item.unit || 'un'}</td>
                        <td className="px-4 py-3">{formatCurrency(avgCost, currency)}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(qty * avgCost, currency)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="movements">
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Ingrediente</th>
                  <th className="px-4 py-3 font-semibold">Quantidade</th>
                  <th className="px-4 py-3 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação registrada</td></tr>
                ) : movements.map(m => (
                  <tr key={m.id} className="border-t border-border/50">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${m.type === 'in' || m.type === 'entry' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.type === 'in' || m.type === 'entry' ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                        {m.type === 'in' || m.type === 'entry' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.ingredientName}</td>
                    <td className="px-4 py-3">{formatNumber(m.quantity)} {m.unit}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{m.notes || m.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modalType === 'entry' ? 'Registrar Entrada' : 'Registrar Saída'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label>Tipo de item *</Label>
              <Select value={formData.itemType} onValueChange={(v) => setFormData({ ...formData, itemType: v, itemId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingredient">Ingrediente</SelectItem>
                  <SelectItem value="resale_product">Produto de Revenda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>{formData.itemType === 'ingredient' ? 'Ingrediente' : 'Produto'} *</Label>
                {formData.itemType === 'ingredient' && !showNewIngredientForm && (
                  <button
                    type="button"
                    onClick={() => setShowNewIngredientForm(true)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Novo ingrediente
                  </button>
                )}
              </div>

              {showNewIngredientForm ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-emerald-700">Criar novo ingrediente</span>
                    <button type="button" onClick={() => setShowNewIngredientForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome *"
                      value={newIngredient.name}
                      onChange={e => setNewIngredient(n => ({ ...n, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateNewIngredient())}
                      className="flex-1 text-sm"
                      autoFocus
                    />
                    <Input
                      placeholder="Unidade (kg, L...)"
                      value={newIngredient.unit}
                      onChange={e => setNewIngredient(n => ({ ...n, unit: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateNewIngredient())}
                      className="w-28 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateNewIngredient}
                      disabled={creatingIngredient || !newIngredient.name.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7 px-3"
                    >
                      {creatingIngredient ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Criar e selecionar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Select value={formData.itemId || 'none'} onValueChange={(v) => setFormData({ ...formData, itemId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {formData.itemType === 'ingredient'
                      ? ingredients.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({formatNumber(i.currentStock || 0)} {i.unit})</SelectItem>)
                      : resaleProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({formatNumber(p.stockQuantity || 0)} {p.unit || 'un'})</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Quantidade *</Label><Input type="number" step="0.01" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required /></div>
            {modalType === 'entry' && <div><Label>Custo unitário (opcional)</Label><Input type="number" step="0.01" value={formData.unitCost} onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })} placeholder="Deixe em branco para manter o atual" /></div>}
            <div>
              <Label>Motivo</Label>
              <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {modalType === 'entry' ? <>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="devolucao">Devolução</SelectItem>
                  </> : <>
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="perda">Perda/Vencimento</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default StockPage;
