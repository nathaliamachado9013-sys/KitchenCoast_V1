import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getSales, createSale, deleteSale, getMenuItems, getSalesSummary } from '../lib/firestore';
import { formatCurrency, formatNumber, formatDateTime, SALES_CHANNELS } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, ShoppingCart, DollarSign, TrendingUp, BookOpen, Wine } from 'lucide-react';

const SalesPage = () => {
  const { restaurant, currency } = useAuth();
  const [sales, setSales] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const emptyForm = { itemId: '', quantitySold: '1', salePrice: '', salesChannel: '', notes: '' };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const [salesData, items, sum] = await Promise.all([
        getSales(restaurant.restaurantId),
        getMenuItems(restaurant.restaurantId),
        getSalesSummary(restaurant.restaurantId, 'today'),
      ]);
      setSales(salesData); setMenuItems(items); setSummary(sum);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar vendas', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleItemSelect = (itemId) => {
    const item = menuItems.find(m => m.id === itemId);
    if (item) setFormData(prev => ({ ...prev, itemId, salePrice: item.salePrice?.toString() || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemId || !formData.quantitySold) { toast({ title: 'Erro', description: 'Item e quantidade são obrigatórios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const result = await createSale(restaurant.restaurantId, {
        itemId: formData.itemId,
        quantitySold: parseFloat(formData.quantitySold),
        salePrice: formData.salePrice ? parseFloat(formData.salePrice) : undefined,
        salesChannel: formData.salesChannel || '',
        notes: formData.notes || '',
      }, menuItems);
      toast({ title: 'Venda registrada!', description: `Lucro: ${formatCurrency(result.profit, currency)}` });
      setModalOpen(false);
      setFormData(emptyForm);
      loadData();
    } catch (err) { toast({ title: 'Erro', description: err.message || 'Erro ao registrar venda', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (sale) => {
    if (!window.confirm('Excluir esta venda?')) return;
    try { await deleteSale(restaurant.restaurantId, sale.id); toast({ title: 'Venda excluída!' }); loadData(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const selectedItem = menuItems.find(m => m.id === formData.itemId);

  return (
    <Layout title="Vendas" actions={<Button onClick={() => setModalOpen(true)} size="sm"><Plus className="w-4 h-4 mr-2" />Registrar Venda</Button>}>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><ShoppingCart className="w-5 h-5 text-blue-600" /><span className="text-sm text-muted-foreground">Vendas hoje</span></div>
          <div className="text-2xl font-bold">{summary?.count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-emerald-600" /><span className="text-sm text-muted-foreground">Receita hoje</span></div>
          <div className="text-2xl font-bold">{formatCurrency(summary?.totalRevenue || 0, currency)}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-amber-600" /><span className="text-sm text-muted-foreground">Lucro hoje</span></div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary?.totalProfit || 0, currency)}</div>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Data/Hora</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Qtd</th>
                <th className="px-4 py-3 font-semibold">Preço</th>
                <th className="px-4 py-3 font-semibold">Receita</th>
                <th className="px-4 py-3 font-semibold">Lucro</th>
                <th className="px-4 py-3 font-semibold">Canal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhuma venda registrada</p>
                </td></tr>
              ) : sales.map(sale => (
                <tr key={sale.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(sale.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{sale.itemName}</div>
                    {sale.notes && <div className="text-xs text-muted-foreground truncate max-w-32">{sale.notes}</div>}
                  </td>
                  <td className="px-4 py-3">{formatNumber(sale.quantitySold, 0)}×</td>
                  <td className="px-4 py-3">{formatCurrency(sale.salePrice, currency)}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(sale.revenue, currency)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(sale.profit, currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{sale.salesChannel || '-'}</td>
                  <td className="px-4 py-3"><Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(sale)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Venda</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label>Item do cardápio *</Label>
              <Select value={formData.itemId || 'none'} onValueChange={(v) => v !== 'none' && handleItemSelect(v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Selecione...</SelectItem>
                  {menuItems.filter(m => m.isAvailable !== false).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        {m.itemType === 'recipe' ? <BookOpen className="w-3.5 h-3.5" /> : <Wine className="w-3.5 h-3.5" />}
                        {m.name} — {formatCurrency(m.salePrice || 0, currency)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="form-grid">
              <div><Label>Quantidade *</Label><Input type="number" step="0.5" min="0.5" value={formData.quantitySold} onChange={(e) => setFormData({ ...formData, quantitySold: e.target.value })} required /></div>
              <div><Label>Preço de venda</Label><Input type="number" step="0.01" value={formData.salePrice} onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })} placeholder={selectedItem ? formatCurrency(selectedItem.salePrice || 0, currency) : ''} /></div>
            </div>

            <div>
              <Label>Canal de venda</Label>
              <Select value={formData.salesChannel || 'none'} onValueChange={(v) => setFormData({ ...formData, salesChannel: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não especificado</SelectItem>
                  {SALES_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Opcional..." />
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

export default SalesPage;
