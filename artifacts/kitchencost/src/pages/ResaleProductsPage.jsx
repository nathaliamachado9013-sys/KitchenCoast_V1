import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { getResaleProducts, createResaleProduct, updateResaleProduct, deleteResaleProduct } from '../lib/firestore';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Pencil, Trash2, Wine, TrendingUp } from 'lucide-react';

const ResaleProductsPage = () => {
  const { restaurant, currency } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const emptyForm = { name: '', category: '', purchasePrice: '', salePrice: '', unit: 'unidade', currentStock: '0', minStock: '0', supplier: '' };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try { setProducts(await getResaleProducts(restaurant.restaurantId)); }
    catch { toast({ title: 'Erro', description: 'Erro ao carregar produtos', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    setFormData(item ? { name: item.name || '', category: item.category || '', purchasePrice: item.purchasePrice?.toString() || '', salePrice: item.salePrice?.toString() || '', unit: item.unit || 'unidade', currentStock: item.currentStock?.toString() || '0', minStock: item.minStock?.toString() || '0', supplier: item.supplier || '' } : emptyForm);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.purchasePrice || !formData.salePrice) { toast({ title: 'Erro', description: 'Nome, custo de compra e preço de venda são obrigatórios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const data = { name: formData.name, category: formData.category, purchasePrice: parseFloat(formData.purchasePrice) || 0, salePrice: parseFloat(formData.salePrice) || 0, unit: formData.unit, currentStock: parseFloat(formData.currentStock) || 0, minStock: parseFloat(formData.minStock) || 0, supplier: formData.supplier };
      if (editingItem) { await updateResaleProduct(restaurant.restaurantId, editingItem.id, data); toast({ title: 'Produto atualizado!' }); }
      else { await createResaleProduct(restaurant.restaurantId, data); toast({ title: 'Produto criado!' }); }
      setModalOpen(false); loadData();
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try { await deleteResaleProduct(restaurant.restaurantId, item.id); toast({ title: 'Excluído!' }); loadData(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const marginColor = (m) => m < 20 ? 'text-red-600' : m < 40 ? 'text-amber-600' : 'text-green-600';

  return (
    <Layout title="Produtos de Revenda" actions={<Button onClick={() => openModal()} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Produto</Button>}>
      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wine className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum produto de revenda cadastrado</p>
          <Button onClick={() => openModal()} className="mt-4" size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar primeiro</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Wine className="w-5 h-5 text-violet-600" /></div>
                  <div>
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openModal(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Custo de compra</span><span>{formatCurrency(p.purchasePrice || 0, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Preço de venda</span><span className="font-medium">{formatCurrency(p.salePrice || 0, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><span className={`font-semibold flex items-center gap-1 ${marginColor(p.margin || 0)}`}><TrendingUp className="w-3.5 h-3.5" />{formatNumber(p.margin || 0, 1)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lucro/un</span><span className="text-emerald-600 font-medium">{formatCurrency(p.profitPerUnit || 0, currency)}</span></div>
              </div>
              {p.currentStock !== undefined && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  Estoque: {p.currentStock} {p.unit} {p.currentStock <= p.minStock ? '⚠️ Baixo' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Produto' : 'Novo Produto de Revenda'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div className="form-grid">
              <div><Label>Categoria</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Ex: Bebidas" /></div>
              <div><Label>Unidade</Label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><Label>Custo de compra *</Label><Input type="number" step="0.01" value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })} required /></div>
              <div><Label>Preço de venda *</Label><Input type="number" step="0.01" value={formData.salePrice} onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })} required /></div>
            </div>
            {formData.purchasePrice && formData.salePrice && (
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span>Lucro/un</span><span className="font-medium text-emerald-600">{formatCurrency((parseFloat(formData.salePrice) || 0) - (parseFloat(formData.purchasePrice) || 0), currency)}</span></div>
                <div className="flex justify-between"><span>Margem</span><span className="font-medium">{formatNumber(parseFloat(formData.salePrice) > 0 ? (((parseFloat(formData.salePrice) - parseFloat(formData.purchasePrice)) / parseFloat(formData.salePrice)) * 100) : 0, 1)}%</span></div>
              </div>
            )}
            <div className="form-grid">
              <div><Label>Estoque Atual</Label><Input type="number" step="0.1" value={formData.currentStock} onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })} /></div>
              <div><Label>Estoque Mínimo</Label><Input type="number" step="0.1" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: e.target.value })} /></div>
            </div>
            <div><Label>Fornecedor</Label><Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></div>
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

export default ResaleProductsPage;
