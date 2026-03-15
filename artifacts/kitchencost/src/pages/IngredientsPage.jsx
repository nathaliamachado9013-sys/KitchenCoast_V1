import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getIngredients, createIngredient, updateIngredient, deleteIngredient, getSuppliers } from '../lib/firestore';
import { formatCurrency, formatNumber, UNITS, INGREDIENT_CATEGORIES } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Pencil, Trash2, AlertTriangle, ShoppingBasket, Search } from 'lucide-react';

const IngredientsPage = () => {
  const { restaurant, currency } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const emptyForm = { name: '', unit: 'kg', costPerUnit: '', supplierId: '', currentStock: '0', minStock: '0', category: '', notes: '' };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const [ings, supps] = await Promise.all([
        getIngredients(restaurant.restaurantId),
        getSuppliers(restaurant.restaurantId),
      ]);
      setIngredients(ings);
      setSuppliers(supps);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar ingredientes', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const filtered = ingredients.filter(i => {
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    const matchStock = !lowStockFilter || (i.currentStock || 0) <= (i.minStock || 0);
    return matchSearch && matchCat && matchStock;
  });

  const openModal = (item = null) => {
    setEditingItem(item);
    setFormData(item ? {
      name: item.name, unit: item.unit, costPerUnit: item.costPerUnit?.toString() || '',
      supplierId: item.supplierId || '', currentStock: item.currentStock?.toString() || '0',
      minStock: item.minStock?.toString() || '0', category: item.category || '',
      notes: item.notes || '',
    } : emptyForm);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.costPerUnit) { toast({ title: 'Erro', description: 'Nome e custo são obrigatórios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const data = {
        name: formData.name, unit: formData.unit,
        costPerUnit: parseFloat(formData.costPerUnit) || 0,
        supplierId: formData.supplierId || null,
        currentStock: parseFloat(formData.currentStock) || 0,
        minStock: parseFloat(formData.minStock) || 0,
        category: formData.category || '',
        notes: formData.notes || '',
      };
      if (editingItem) { await updateIngredient(restaurant.restaurantId, editingItem.id, data); toast({ title: 'Ingrediente atualizado!' }); }
      else { await createIngredient(restaurant.restaurantId, data); toast({ title: 'Ingrediente criado!' }); }
      setModalOpen(false); loadData();
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try { await deleteIngredient(restaurant.restaurantId, item.id); toast({ title: 'Excluído!' }); loadData(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const getStockStatus = (item) => {
    if ((item.currentStock || 0) <= 0) return { label: 'Crítico', cls: 'bg-red-100 text-red-700' };
    if ((item.currentStock || 0) <= (item.minStock || 0)) return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'OK', cls: 'bg-green-100 text-green-700' };
  };

  return (
    <Layout title="Ingredientes" actions={<Button onClick={() => openModal()} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Ingrediente</Button>}>
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar ingrediente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {INGREDIENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={lowStockFilter ? 'default' : 'outline'} size="sm" onClick={() => setLowStockFilter(!lowStockFilter)}>
          <AlertTriangle className="w-4 h-4 mr-1" /> Estoque Baixo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Categoria</th>
                <th className="px-4 py-3 font-semibold">Custo/Unid</th>
                <th className="px-4 py-3 font-semibold">Estoque</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Fornecedor</th>
                <th className="px-4 py-3 font-semibold">Observações</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground"><ShoppingBasket className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhum ingrediente encontrado</p></td></tr>
              ) : filtered.map(item => {
                const st = getStockStatus(item);
                const supplier = suppliers.find(s => s.id === item.supplierId);
                return (
                  <tr key={item.id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category || '-'}</td>
                    <td className="px-4 py-3">{formatCurrency(item.costPerUnit, currency)}/{item.unit}</td>
                    <td className="px-4 py-3">{formatNumber(item.currentStock || 0)} {item.unit}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{supplier?.name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-36 truncate" title={item.notes || ''}>{item.notes || '-'}</td>
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
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Ingrediente' : 'Novo Ingrediente'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div className="form-grid">
              <div>
                <Label>Unidade</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formData.category || 'none'} onValueChange={(v) => setFormData({ ...formData, category: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {INGREDIENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="form-grid">
              <div><Label>Custo por {formData.unit} *</Label><Input type="number" step="0.01" value={formData.costPerUnit} onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })} required /></div>
              <div>
                <Label>Fornecedor</Label>
                <Select value={formData.supplierId || 'none'} onValueChange={(v) => setFormData({ ...formData, supplierId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem fornecedor</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="form-grid">
              <div><Label>Estoque Atual</Label><Input type="number" step="0.01" value={formData.currentStock} onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })} /></div>
              <div><Label>Estoque Mínimo</Label><Input type="number" step="0.01" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Informações adicionais, marca preferida, instruções de armazenamento..." /></div>
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

export default IngredientsPage;
