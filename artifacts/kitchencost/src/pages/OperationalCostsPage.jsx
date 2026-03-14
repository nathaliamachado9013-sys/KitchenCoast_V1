import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { getOperationalCosts, updateOperationalCosts, recalculateAllRecipes } from '../lib/firestore';
import { formatCurrency } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Home, Zap, Droplets, Wifi, Users, FileText, Receipt, MoreHorizontal, RefreshCw, Calculator } from 'lucide-react';

const COST_FIELDS = [
  { key: 'rent', label: 'Aluguel', icon: Home },
  { key: 'electricity', label: 'Energia Elétrica', icon: Zap },
  { key: 'water', label: 'Água', icon: Droplets },
  { key: 'internet', label: 'Internet/Telefone', icon: Wifi },
  { key: 'salaries', label: 'Salários', icon: Users },
  { key: 'accounting', label: 'Contabilidade', icon: FileText },
  { key: 'taxes', label: 'Impostos', icon: Receipt },
  { key: 'otherCosts', label: 'Outros', icon: MoreHorizontal },
];

const OperationalCostsPage = () => {
  const { restaurant, currency } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [formData, setFormData] = useState({ rent: '0', electricity: '0', water: '0', internet: '0', salaries: '0', accounting: '0', taxes: '0', otherCosts: '0', averageDishesPerMonth: '1' });

  useEffect(() => { if (restaurant?.restaurantId) loadCosts(); }, [restaurant]);

  const loadCosts = async () => {
    try {
      const costs = await getOperationalCosts(restaurant.restaurantId);
      setFormData({
        rent: costs.rent?.toString() || '0',
        electricity: costs.electricity?.toString() || '0',
        water: costs.water?.toString() || '0',
        internet: costs.internet?.toString() || '0',
        salaries: costs.salaries?.toString() || '0',
        accounting: costs.accounting?.toString() || '0',
        taxes: costs.taxes?.toString() || '0',
        otherCosts: costs.otherCosts?.toString() || '0',
        averageDishesPerMonth: costs.averageDishesPerMonth?.toString() || '1',
      });
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar custos', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const totalMonthly = COST_FIELDS.reduce((sum, f) => sum + (parseFloat(formData[f.key]) || 0), 0);
  const avgDishes = parseFloat(formData.averageDishesPerMonth) || 1;
  const costPerDish = totalMonthly / avgDishes;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        rent: parseFloat(formData.rent) || 0,
        electricity: parseFloat(formData.electricity) || 0,
        water: parseFloat(formData.water) || 0,
        internet: parseFloat(formData.internet) || 0,
        salaries: parseFloat(formData.salaries) || 0,
        accounting: parseFloat(formData.accounting) || 0,
        taxes: parseFloat(formData.taxes) || 0,
        otherCosts: parseFloat(formData.otherCosts) || 0,
        averageDishesPerMonth: parseFloat(formData.averageDishesPerMonth) || 1,
      };
      await updateOperationalCosts(restaurant.restaurantId, data);
      toast({ title: 'Custos salvos com sucesso!' });
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar custos', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const costs = {
        rent: parseFloat(formData.rent) || 0,
        electricity: parseFloat(formData.electricity) || 0,
        water: parseFloat(formData.water) || 0,
        internet: parseFloat(formData.internet) || 0,
        salaries: parseFloat(formData.salaries) || 0,
        accounting: parseFloat(formData.accounting) || 0,
        taxes: parseFloat(formData.taxes) || 0,
        otherCosts: parseFloat(formData.otherCosts) || 0,
        averageDishesPerMonth: parseFloat(formData.averageDishesPerMonth) || 1,
      };
      const count = await recalculateAllRecipes(restaurant.restaurantId, costs);
      toast({ title: `${count} receitas recalculadas com sucesso!` });
    } catch { toast({ title: 'Erro', description: 'Erro ao recalcular receitas', variant: 'destructive' }); }
    finally { setRecalculating(false); }
  };

  if (loading) return <Layout title="Custos Fixos"><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout title="Custos Fixos Mensais">
      <div className="max-w-2xl">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card col-span-1">
            <div className="text-sm text-muted-foreground mb-1">Total Mensal</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalMonthly, currency)}</div>
          </div>
          <div className="stat-card col-span-1">
            <div className="text-sm text-muted-foreground mb-1">Custo por Prato</div>
            <div className="text-2xl font-bold">{formatCurrency(costPerDish, currency)}</div>
          </div>
          <div className="stat-card col-span-1">
            <div className="text-sm text-muted-foreground mb-1">Pratos/Mês</div>
            <div className="text-2xl font-bold">{avgDishes}</div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {COST_FIELDS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <Label className="w-40 flex-shrink-0">{label}</Label>
                <Input type="number" step="0.01" min="0" className="flex-1" value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} />
              </div>
            ))}

            <div className="border-t pt-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Calculator className="w-4 h-4 text-muted-foreground" />
              </div>
              <Label className="w-40 flex-shrink-0">Média de pratos/mês</Label>
              <Input type="number" step="1" min="1" className="flex-1" value={formData.averageDishesPerMonth} onChange={(e) => setFormData({ ...formData, averageDishesPerMonth: e.target.value })} />
            </div>

            <div className="flex justify-between items-center pt-4">
              <Button type="button" variant="outline" onClick={handleRecalculate} disabled={recalculating || saving}>
                {recalculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Recalcular Receitas
              </Button>
              <Button type="submit" disabled={saving || recalculating}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Custos
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-1">Como funciona</h4>
          <p className="text-sm text-blue-700">O custo fixo por prato é calculado dividindo o custo mensal total pela média de pratos vendidos. Este valor é adicionado automaticamente ao custo de cada receita. Após salvar, clique em "Recalcular Receitas" para atualizar todas as fichas técnicas.</p>
        </div>
      </div>
    </Layout>
  );
};

export default OperationalCostsPage;
