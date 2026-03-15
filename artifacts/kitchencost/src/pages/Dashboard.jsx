import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import {
  getDashboardSummary,
  getLowStockIngredients,
  getMenuProfitability,
} from '../lib/firestore';
import { formatCurrency } from '../lib/utils';
import { ShoppingBasket, BookOpen, Truck, AlertTriangle, DollarSign, TrendingUp, Loader2, Package, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { restaurant, currency } = useAuth();
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [topProfitable, setTopProfitable] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!restaurant?.restaurantId) return;
    loadData();
  }, [restaurant]);

  const loadData = async () => {
    try {
      const [summaryData, alerts, profitData] = await Promise.all([
        getDashboardSummary(restaurant.restaurantId),
        getLowStockIngredients(restaurant.restaurantId),
        getMenuProfitability(restaurant.restaurantId, 'month'),
      ]);
      setSummary(summaryData);
      setLowStock(alerts);
      setTopProfitable(profitData.topProfitable || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <Layout title="Dashboard">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </Layout>
  );

  const stats = [
    { label: 'Ingredientes', value: summary?.ingredientsCount || 0, icon: ShoppingBasket, color: 'text-blue-600', bg: 'bg-blue-50', path: '/ingredients' },
    { label: 'Fichas Técnicas', value: summary?.recipesCount || 0, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/recipes' },
    { label: 'Fornecedores', value: summary?.suppliersCount || 0, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50', path: '/suppliers' },
    {
      label: 'Alertas Estoque', value: summary?.lowStockAlerts || 0,
      icon: AlertTriangle,
      color: summary?.lowStockAlerts > 0 ? 'text-red-600' : 'text-gray-400',
      bg: summary?.lowStockAlerts > 0 ? 'bg-red-50' : 'bg-gray-50',
      path: '/stock',
    },
  ];

  const financialStats = [
    { label: 'Valor do Inventário', value: formatCurrency(summary?.inventoryValue || 0, currency), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Custo Produção Hoje', value: formatCurrency(summary?.todayProductionCost || 0, currency), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Margem Média', value: `${summary?.averageMargin || 0}%`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <Layout title="Dashboard">
      {lowStock.length > 0 && (
        <div className="alert-banner mb-6">
          <AlertTriangle className="w-5 h-5" />
          <span><strong>{lowStock.length} ingrediente(s)</strong> com estoque baixo precisam de reposição</span>
          <button onClick={() => navigate('/stock')} className="ml-auto text-sm font-medium underline">Ver detalhes</button>
        </div>
      )}

      <div className="dashboard-grid mb-6">
        {stats.map((s, i) => (
          <div key={i} className="stat-card cursor-pointer" onClick={() => navigate(s.path)}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <span className="text-sm text-muted-foreground font-medium">{s.label}</span>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {financialStats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <span className="text-sm text-muted-foreground font-medium">{s.label}</span>
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="chart-container">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" /> Top Itens Lucrativos (mês)
          </h3>
          {topProfitable.length > 0 ? (
            <div className="space-y-3">
              {topProfitable.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-xs">{item.unitsSold} vendidos</span>
                    <span className="font-semibold text-emerald-600 text-sm">{formatCurrency(item.totalProfit, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma venda registrada este mês</p>
          )}
        </div>

        <div className="chart-container">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Estoque Baixo
          </h3>
          {lowStock.length > 0 ? (
            <div className="space-y-3">
              {lowStock.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="font-medium text-sm">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 text-sm font-medium">{item.currentStock} {item.unit}</span>
                    <span className="text-muted-foreground text-xs">mín: {item.minStock}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Todos os itens com estoque adequado ✓</p>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
