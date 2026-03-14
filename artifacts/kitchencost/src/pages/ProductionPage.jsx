import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { getProductions, registerProduction, deleteProduction, getRecipes, getIngredients, getProductionSummary } from '../lib/firestore';
import { formatCurrency, formatNumber, formatDateTime } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, ChefHat, DollarSign, Calendar, Hash } from 'lucide-react';

const ProductionPage = () => {
  const { restaurant, currency } = useAuth();
  const [productions, setProductions] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({ recipeId: '', quantity: '1', notes: '' });

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const [prods, recs, ings, sum] = await Promise.all([
        getProductions(restaurant.restaurantId),
        getRecipes(restaurant.restaurantId),
        getIngredients(restaurant.restaurantId),
        getProductionSummary(restaurant.restaurantId, 'today'),
      ]);
      setProductions(prods); setRecipes(recs); setIngredients(ings); setSummary(sum);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar produções', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const selectedRecipe = recipes.find(r => r.id === formData.recipeId);
  // FIX: Shows estimated cost using CURRENT ingredient prices, not cached value
  const estimatedCost = selectedRecipe
    ? (() => {
        let ingsCost = 0;
        for (const ri of selectedRecipe.ingredients || []) {
          const ing = ingredients.find(i => i.id === ri.ingredientId);
          if (!ing) continue;
          ingsCost += (ri.quantity || 0) * (ing.costPerUnit || 0);
        }
        const yieldQty = selectedRecipe.yieldQuantity || 1;
        const variableTotal = (selectedRecipe.variableCosts || []).reduce((s, v) => s + (v.value || 0), 0);
        return (ingsCost / yieldQty + variableTotal) * (parseFloat(formData.quantity) || 1);
      })()
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.recipeId || !formData.quantity) { toast({ title: 'Erro', description: 'Receita e quantidade são obrigatórios', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const result = await registerProduction(restaurant.restaurantId, { recipeId: formData.recipeId, quantity: parseFloat(formData.quantity), notes: formData.notes }, recipes, ingredients);
      toast({ title: 'Produção registrada!', description: `${result.recipeName} — Custo: ${formatCurrency(result.totalCost, currency)}` });
      setModalOpen(false);
      setFormData({ recipeId: '', quantity: '1', notes: '' });
      loadData();
    } catch (err) { toast({ title: 'Erro', description: err.message || 'Erro ao registrar produção', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir produção de "${item.recipeName}"? O estoque NÃO será restaurado.`)) return;
    try { await deleteProduction(restaurant.restaurantId, item.id); toast({ title: 'Produção excluída!' }); loadData(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  return (
    <Layout title="Produção" actions={<Button onClick={() => setModalOpen(true)} size="sm"><Plus className="w-4 h-4 mr-2" />Registrar Produção</Button>}>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><ChefHat className="w-5 h-5 text-emerald-600" /><span className="text-sm text-muted-foreground">Produções hoje</span></div>
          <div className="text-2xl font-bold">{summary?.count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-amber-600" /><span className="text-sm text-muted-foreground">Custo hoje</span></div>
          <div className="text-2xl font-bold">{formatCurrency(summary?.totalCost || 0, currency)}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2"><Hash className="w-5 h-5 text-blue-600" /><span className="text-sm text-muted-foreground">Total registros</span></div>
          <div className="text-2xl font-bold">{productions.length}</div>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Data/Hora</th>
                <th className="px-4 py-3 font-semibold">Receita</th>
                <th className="px-4 py-3 font-semibold">Quantidade</th>
                <th className="px-4 py-3 font-semibold">Custo Total</th>
                <th className="px-4 py-3 font-semibold">Custo/Un</th>
                <th className="px-4 py-3 font-semibold">Obs.</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {productions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhuma produção registrada</p>
                </td></tr>
              ) : productions.map(p => (
                <tr key={p.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(p.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{p.recipeName}</td>
                  <td className="px-4 py-3">{formatNumber(p.quantity, 1)}×</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(p.totalCost, currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCurrency(p.costPerUnit, currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-32 truncate">{p.notes || '-'}</td>
                  <td className="px-4 py-3"><Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Produção</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label>Receita *</Label>
              <Select value={formData.recipeId || 'none'} onValueChange={(v) => setFormData({ ...formData, recipeId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a receita" /></SelectTrigger>
                <SelectContent>{recipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name} — {formatCurrency(r.costPerPortion || 0, currency)}/porção</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade (vezes a receita) *</Label>
              <Input type="number" step="0.5" min="0.5" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
            </div>
            {selectedRecipe && formData.quantity && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center">
                <span className="font-medium text-amber-700 text-sm">Custo estimado (preços atuais):</span>
                <span className="text-lg font-bold text-amber-700">{formatCurrency(estimatedCost, currency)}</span>
              </div>
            )}
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

export default ProductionPage;
