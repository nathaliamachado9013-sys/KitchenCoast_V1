import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getMenuProfitability, getCostReport, getMarginReport } from '../lib/firestore';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, BarChart3, DollarSign, Star } from 'lucide-react';

const PERIOD_LABELS = { today: 'Hoje', week: 'Esta Semana', month: 'Este Mês', year: 'Este Ano' };

const CLASSIFICATION_INFO = {
  STAR: { label: 'Estrela', cls: 'bg-yellow-100 text-yellow-800', desc: 'Alta venda, alto lucro' },
  PLOWHORSE: { label: 'Cavalo de Batalha', cls: 'bg-blue-100 text-blue-800', desc: 'Alta venda, baixo lucro' },
  PUZZLE: { label: 'Enigma', cls: 'bg-purple-100 text-purple-800', desc: 'Baixa venda, alto lucro' },
  DOG: { label: 'Abacaxi', cls: 'bg-red-100 text-red-800', desc: 'Baixa venda, baixo lucro' },
  UNCLASSIFIED: { label: 'Sem dados', cls: 'bg-gray-100 text-gray-500', desc: '' },
};

const ReportsPage = () => {
  const { restaurant, currency } = useAuth();
  const [period, setPeriod] = useState('month');
  const [profitData, setProfitData] = useState(null);
  const [costData, setCostData] = useState(null);
  const [marginData, setMarginData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profitability');

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant, period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profit, costs, margins] = await Promise.all([
        getMenuProfitability(restaurant.restaurantId, period),
        getCostReport(restaurant.restaurantId, period),
        getMarginReport(restaurant.restaurantId),
      ]);
      setProfitData(profit); setCostData(costs); setMarginData(margins);
    } catch { console.error('Error loading reports'); }
    finally { setLoading(false); }
  };

  const marginBarColor = (m) => m < 0 ? 'bg-red-500' : m < 20 ? 'bg-amber-500' : m < 40 ? 'bg-blue-500' : 'bg-green-500';
  const marginTextColor = (m) => m < 0 ? 'text-red-600' : m < 20 ? 'text-amber-600' : m < 40 ? 'text-blue-600' : 'text-green-600';

  return (
    <Layout title="Relatórios" actions={
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    }>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {profitData && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="stat-card">
                <div className="text-sm text-muted-foreground mb-1">Itens Vendidos</div>
                <div className="text-2xl font-bold">{profitData.summary?.totalItemsSold || 0}</div>
              </div>
              <div className="stat-card">
                <div className="text-sm text-muted-foreground mb-1">Receita Total</div>
                <div className="text-2xl font-bold">{formatCurrency(profitData.summary?.totalRevenue || 0, currency)}</div>
              </div>
              <div className="stat-card">
                <div className="text-sm text-muted-foreground mb-1">Lucro Total</div>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(profitData.summary?.totalProfit || 0, currency)}</div>
              </div>
              <div className="stat-card">
                <div className="text-sm text-muted-foreground mb-1">Margem Média (receitas)</div>
                <div className={`text-2xl font-bold ${marginTextColor(marginData?.averageMargin || 0)}`}>{formatNumber(marginData?.averageMargin || 0, 1)}%</div>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="profitability"><BarChart3 className="w-4 h-4 mr-1.5" />Rentabilidade</TabsTrigger>
              <TabsTrigger value="costs"><DollarSign className="w-4 h-4 mr-1.5" />Custos de Produção</TabsTrigger>
              <TabsTrigger value="margins"><TrendingUp className="w-4 h-4 mr-1.5" />Margens por Receita</TabsTrigger>
            </TabsList>

            <TabsContent value="profitability">
              {profitData && (
                <div className="space-y-4">
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30">
                      <h3 className="font-semibold text-sm">Análise de Cardápio — {PERIOD_LABELS[period]}</h3>
                      <p className="text-xs text-muted-foreground">Engenharia de menu: classificação por venda e lucratividade</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-semibold">Item</th>
                          <th className="px-4 py-3 font-semibold">Categoria</th>
                          <th className="px-4 py-3 font-semibold">Classificação</th>
                          <th className="px-4 py-3 font-semibold">Custo</th>
                          <th className="px-4 py-3 font-semibold">Preço</th>
                          <th className="px-4 py-3 font-semibold">Lucro/un</th>
                          <th className="px-4 py-3 font-semibold">Vendidos</th>
                          <th className="px-4 py-3 font-semibold">Lucro Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitData.items?.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum item no cardápio</td></tr>
                        ) : profitData.items?.map(item => {
                          const cls = CLASSIFICATION_INFO[item.classification] || CLASSIFICATION_INFO.UNCLASSIFIED;
                          return (
                            <tr key={item.id} className="border-t border-border/50 hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3 font-medium">{item.name}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{item.category || '-'}</td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${cls.cls}`} title={cls.desc}>{cls.label}</span></td>
                              <td className="px-4 py-3">{formatCurrency(item.cost, currency)}</td>
                              <td className="px-4 py-3">{formatCurrency(item.salePrice, currency)}</td>
                              <td className={`px-4 py-3 font-semibold ${item.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(item.profitPerUnit, currency)}</td>
                              <td className="px-4 py-3">{formatNumber(item.unitsSold, 0)}</td>
                              <td className={`px-4 py-3 font-semibold ${item.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(item.totalProfit, currency)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(CLASSIFICATION_INFO).filter(([k]) => k !== 'UNCLASSIFIED').map(([key, info]) => {
                      const count = profitData.items?.filter(i => i.classification === key).length || 0;
                      return (
                        <div key={key} className="stat-card text-center">
                          <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium mb-2 ${info.cls}`}>{info.label}</div>
                          <div className="text-2xl font-bold">{count}</div>
                          <p className="text-xs text-muted-foreground mt-1">{info.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="costs">
              {costData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="stat-card">
                      <div className="text-sm text-muted-foreground mb-1">Custo Total — {PERIOD_LABELS[period]}</div>
                      <div className="text-2xl font-bold">{formatCurrency(costData.totalCost, currency)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-sm text-muted-foreground mb-1">Produções registradas</div>
                      <div className="text-2xl font-bold">{costData.productionCount}</div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 font-semibold text-sm">Custo por Receita</div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-semibold">Receita</th>
                          <th className="px-4 py-3 font-semibold">Produções</th>
                          <th className="px-4 py-3 font-semibold">Custo Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costData.byRecipe?.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhuma produção registrada</td></tr>
                        ) : costData.byRecipe?.map((r, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 font-medium">{r.name}</td>
                            <td className="px-4 py-3">{r.count}</td>
                            <td className="px-4 py-3 font-semibold">{formatCurrency(r.totalCost, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="margins">
              {marginData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-3">
                    {[['negative', 'Negativa (<0%)', 'bg-red-100 text-red-800'], ['low', 'Baixa (0-20%)', 'bg-amber-100 text-amber-800'], ['medium', 'Média (20-40%)', 'bg-blue-100 text-blue-800'], ['good', 'Boa (40-60%)', 'bg-green-100 text-green-800'], ['excellent', 'Excelente (>60%)', 'bg-emerald-100 text-emerald-800']].map(([key, label, cls]) => (
                      <div key={key} className="stat-card text-center">
                        <div className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-2 ${cls}`}>{label}</div>
                        <div className="text-2xl font-bold">{marginData.distribution?.[key] || 0}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 font-semibold text-sm">Margem por Receita</div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-semibold">Receita</th>
                          <th className="px-4 py-3 font-semibold">Categoria</th>
                          <th className="px-4 py-3 font-semibold">Custo/Porção</th>
                          <th className="px-4 py-3 font-semibold">Preço de Venda</th>
                          <th className="px-4 py-3 font-semibold">Lucro/Porção</th>
                          <th className="px-4 py-3 font-semibold">Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marginData.recipes?.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma receita com preço definido</td></tr>
                        ) : marginData.recipes?.sort((a, b) => b.margin - a.margin).map((r, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 font-medium">{r.name}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{r.category || '-'}</td>
                            <td className="px-4 py-3">{formatCurrency(r.cost, currency)}</td>
                            <td className="px-4 py-3">{formatCurrency(r.sellingPrice, currency)}</td>
                            <td className={`px-4 py-3 font-semibold ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(r.profit, currency)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-1.5 max-w-20">
                                  <div className={`h-full rounded-full ${marginBarColor(r.margin)}`} style={{ width: `${Math.min(100, Math.max(0, r.margin))}%` }} />
                                </div>
                                <span className={`font-semibold text-xs ${marginTextColor(r.margin)}`}>{formatNumber(r.margin, 1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </Layout>
  );
};

export default ReportsPage;
