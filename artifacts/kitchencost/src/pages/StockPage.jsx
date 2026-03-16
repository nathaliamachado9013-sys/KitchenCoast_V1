import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getIngredients, getResaleProducts, getStockMovements, createStockEntry, createStockExit, getInventoryValue } from '../lib/firestore';
import { formatCurrency, formatNumber, formatDateTime } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Package, ArrowUpCircle, ArrowDownCircle, AlertTriangle, DollarSign } from 'lucide-react';

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
  const [formData, setFormData] = useState({ ingredientId: '', quantity: '', unitCost: '', reason: 'compra' });

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
    setFormData({ ingredientId: '', quantity: '', unitCost: '', reason: type === 'entry' ? 'compra' : 'producao' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ingredientId || !formData.quantity) { toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (modalType === 'entry') {
        await createStockEntry(restaurant.restaurantId, { ingredientId: formData.ingredientId, quantity: parseFloat(formData.quantity), unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined, reason: formData.reason }, ingredients);
        toast({ title: 'Entrada registrada!' });
      } else {
        await createStockExit(restaurant.restaurantId, { ingredientId: formData.ingredientId, quantity: parseFloat(formData.quantity), reason: formData.reason }, ingredients);
        toast({ title: 'Saída registrada!' });
      }
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
              <Label>Ingrediente *</Label>
              <Select value={formData.ingredientId || 'none'} onValueChange={(v) => setFormData({ ...formData, ingredientId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{ingredients.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({formatNumber(i.currentStock || 0)} {i.unit})</SelectItem>)}</SelectContent>
              </Select>
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
