import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getInvoicesBySupplier, getInvoices, deleteInvoiceWithStockReversal,
} from '../lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Loader2, Pencil, Trash2, Truck, Phone, Mail, MapPin,
  FileText, ArrowLeft, Search, ExternalLink, ReceiptText,
} from 'lucide-react';
import { formatCurrency as globalFormatCurrency } from '../lib/utils';

const emptyForm = { name: '', contactName: '', phone: '', email: '', address: '', notes: '' };

const STATUS_LABELS = {
  draft: 'Rascunho',
  extracted: 'Extraído',
  in_review: 'Em revisão',
  imported: 'Importado',
  with_divergence: 'Com divergência',
  cancelled: 'Cancelado',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  extracted: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  imported: 'bg-green-100 text-green-700',
  with_divergence: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
};


const formatDate = (val) => {
  if (!val) return '—';
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

const SuppliersPage = () => {
  const { restaurant, currency } = useAuth();
  const formatCurrency = (val) => globalFormatCurrency(val, currency);
  const [suppliers, setSuppliers] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState(emptyForm);

  // Detail view state
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [activeTab, setActiveTab] = useState('dados');
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const tenantId = restaurant?.restaurantId || restaurant?.id;

  useEffect(() => { if (tenantId) loadData(); }, [tenantId]);

  const [invoiceSummary, setInvoiceSummary] = useState({});

  const loadData = async () => {
    try {
      const [data, allInvoices] = await Promise.all([
        getSuppliers(tenantId),
        getInvoices(tenantId).catch(() => []),
      ]);
      setSuppliers(data);
      setAllInvoices(allInvoices);
      const summary = {};
      for (const inv of allInvoices) {
        const sid = inv.supplierId;
        if (!sid) continue;
        if (!summary[sid]) summary[sid] = { totalSpent: 0, totalInvoices: 0, lastDate: null };
        summary[sid].totalInvoices += 1;
        if (inv.status === 'imported' || inv.status === 'with_divergence') {
          summary[sid].totalSpent += inv.totalAmount || 0;
        }
        const invDate = inv.invoiceDate || inv.createdAt;
        if (invDate && (!summary[sid].lastDate || invDate > summary[sid].lastDate)) {
          summary[sid].lastDate = invDate;
        }
      }
      setInvoiceSummary(summary);
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar fornecedores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (supplier) => {
    setSelectedSupplier(supplier);
    setActiveTab('dados');
    setInvoiceSearch('');
    setSupplierInvoices([]);
  };

  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Excluir a nota Nº ${inv.invoiceNumber || 'sem número'}?\n\nEsta ação irá reverter todos os movimentos de estoque associados.`)) return;
    setDeletingInvoiceId(inv.id);
    try {
      await deleteInvoiceWithStockReversal(tenantId, inv.id);
      toast({ title: 'Nota excluída e estoque revertido com sucesso.' });
      await loadData();
    } catch (err) {
      toast({ title: 'Erro ao excluir nota', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const loadInvoicesForTab = (supplier, invoiceList) => {
    const list = invoiceList || allInvoices;
    const filtered = list
      .filter(inv => inv.supplierId === supplier.id)
      .slice()
      .sort((a, b) => {
        const da = a.invoiceDate || '';
        const db2 = b.invoiceDate || '';
        if (da && db2 && da !== db2) return da < db2 ? 1 : -1;
        const ca = a.createdAt?.seconds || 0;
        const cb = b.createdAt?.seconds || 0;
        return cb - ca;
      });
    setSupplierInvoices(filtered);
  };

  useEffect(() => {
    if (selectedSupplier && activeTab === 'notas') {
      loadInvoicesForTab(selectedSupplier);
    }
  }, [allInvoices, selectedSupplier, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'notas' && selectedSupplier) {
      loadInvoicesForTab(selectedSupplier);
    }
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    setFormData(item ? {
      name: item.name || '',
      contactName: item.contactName || item.contact || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      notes: item.notes || '',
    } : emptyForm);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateSupplier(tenantId, editingItem.id, formData);
        toast({ title: 'Fornecedor atualizado!' });
        if (selectedSupplier?.id === editingItem.id) {
          setSelectedSupplier({ ...selectedSupplier, ...formData });
        }
      } else {
        await createSupplier(tenantId, formData);
        toast({ title: 'Fornecedor criado!' });
      }
      setModalOpen(false);
      loadData();
    } catch {
      toast({ title: 'Erro', description: 'Erro ao salvar fornecedor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir fornecedor "${item.name}"?`)) return;
    try {
      await deleteSupplier(tenantId, item.id);
      toast({ title: 'Fornecedor excluído!' });
      if (selectedSupplier?.id === item.id) setSelectedSupplier(null);
      loadData();
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  // Derived invoice search
  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return supplierInvoices;
    const q = invoiceSearch.toLowerCase();
    return supplierInvoices.filter(inv => {
      const num = (inv.invoiceNumber || '').toLowerCase();
      const total = String(inv.totalAmount || '');
      const items = (inv.confirmedJson?.items || inv.extractedJson?.items || [])
        .map(i => `${i.rawDescription || ''} ${i.suggestedName || ''}`.toLowerCase())
        .join(' ');
      return num.includes(q) || total.includes(q) || items.includes(q);
    });
  }, [supplierInvoices, invoiceSearch]);

  // Supplier metrics
  const supplierMetrics = useMemo(() => {
    if (!supplierInvoices.length) return null;
    const total = supplierInvoices.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
    const lastDate = supplierInvoices[0]?.invoiceDate || null;
    const avg = supplierInvoices.length > 0 ? total / supplierInvoices.length : 0;
    return {
      count: supplierInvoices.length,
      totalSpent: total,
      lastDate,
      avgInvoice: avg,
    };
  }, [supplierInvoices]);

  // ── SUPPLIER DETAIL VIEW ─────────────────────────────────────────────────
  if (selectedSupplier) {
    const s = selectedSupplier;
    return (
      <Layout>
        <div className="page-container">
          {/* Header */}
          <div className="page-header mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedSupplier(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h1 className="page-title">{s.name}</h1>
                  {(s.contactName || s.contact) && (
                    <p className="text-sm text-muted-foreground">{s.contactName || s.contact}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openModal(s)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => handleDelete(s)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {[
              { key: 'dados', label: 'Dados do Fornecedor' },
              { key: 'notas', label: 'Notas Fiscais' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Dados */}
          {activeTab === 'dados' && (
            <div className="card max-w-lg">
              <div className="space-y-3 text-sm">
                {(s.contactName || s.contact) && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 shrink-0">Contato</span>
                    <span className="font-medium">{s.contactName || s.contact}</span>
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 shrink-0 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Telefone
                    </span>
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 shrink-0 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </span>
                    <span>{s.email}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 shrink-0 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Endereço
                    </span>
                    <span>{s.address}</span>
                  </div>
                )}
                {s.notes && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Observações
                    </p>
                    <p className="text-sm text-foreground">{s.notes}</p>
                  </div>
                )}
                {!s.contactName && !s.contact && !s.phone && !s.email && !s.address && !s.notes && (
                  <p className="text-muted-foreground text-sm">Nenhuma informação adicional cadastrada.</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button size="sm" variant="outline" onClick={() => openModal(s)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar dados
                </Button>
              </div>
            </div>
          )}

          {/* Tab: Notas */}
          {activeTab === 'notas' && (
            <div>
              {/* Summary metrics */}
              {supplierMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="stat-card text-center">
                    <p className="text-2xl font-bold text-foreground">{supplierMetrics.count}</p>
                    <p className="text-xs text-muted-foreground mt-1">Notas fiscais</p>
                  </div>
                  <div className="stat-card text-center">
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(supplierMetrics.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total gasto</p>
                  </div>
                  <div className="stat-card text-center">
                    <p className="text-base font-semibold text-foreground">{formatDate(supplierMetrics.lastDate)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Última compra</p>
                  </div>
                  <div className="stat-card text-center">
                    <p className="text-lg font-bold text-foreground">{formatCurrency(supplierMetrics.avgInvoice)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Média por nota</p>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por número, item ou valor..."
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                />
              </div>

              {loadingInvoices ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ReceiptText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  {supplierInvoices.length === 0 ? (
                    <>
                      <p className="font-medium">Nenhuma nota fiscal importada</p>
                      <p className="text-sm mt-1">Importe notas deste fornecedor na tela de Compras.</p>
                    </>
                  ) : (
                    <p className="font-medium">Nenhuma nota corresponde à busca.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredInvoices.map(inv => {
                    const itemCount = (inv.confirmedJson?.items || inv.extractedJson?.items || []).length;
                    return (
                      <div key={inv.id} className="card flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                          <ReceiptText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {inv.invoiceNumber ? `Nº ${inv.invoiceNumber}` : 'Sem número'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || STATUS_COLORS.draft}`}>
                              {STATUS_LABELS[inv.status] || inv.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            <span>{formatDate(inv.invoiceDate)}</span>
                            <span>{itemCount} item(ns)</span>
                            <span className="font-medium text-foreground">{formatCurrency(inv.totalAmount)}</span>
                          </div>
                        </div>
                        {inv.fileUrl && (
                          <a
                            href={inv.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:underline shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver arquivo
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-destructive shrink-0"
                          disabled={deletingInvoiceId === inv.id}
                          onClick={e => { e.stopPropagation(); handleDeleteInvoice(inv); }}
                        >
                          {deletingInvoiceId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit modal (reused) */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
              <div><Label>Contato</Label><Input value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} placeholder="Nome do responsável" /></div>
              <div className="form-grid">
                <div><Label>Telefone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              </div>
              <div><Label>Endereço</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Informações adicionais, condições de pagamento, prazo de entrega..." /></div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingItem ? 'Salvar' : 'Criar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  // ── SUPPLIER LIST ─────────────────────────────────────────────────────────
  return (
    <Layout title="Fornecedores" actions={
      <Button onClick={() => openModal()} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Fornecedor</Button>
    }>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum fornecedor cadastrado</p>
          <Button onClick={() => openModal()} className="mt-4" size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar primeiro</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <div
              key={s.id}
              className="stat-card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail(s)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold">{s.name}</h3>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openModal(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => handleDelete(s)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {(s.contactName || s.contact) && <div className="flex items-center gap-2"><span className="font-medium text-foreground">Contato:</span> {s.contactName || s.contact}</div>}
                {s.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{s.phone}</div>}
                {s.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{s.email}</div>}
                {s.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{s.address}</div>}
                {s.notes && (
                  <div className="flex items-start gap-2 pt-1 border-t border-border/40 mt-1">
                    <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="text-xs italic">{s.notes}</span>
                  </div>
                )}
              </div>
              {(() => {
                const sm = invoiceSummary[s.id];
                if (!sm || sm.totalInvoices === 0) return <p className="text-xs text-muted-foreground mt-3">Sem notas fiscais registradas</p>;
                return (
                  <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-xs text-center">
                    <div><p className="text-muted-foreground">Notas</p><p className="font-semibold text-foreground">{sm.totalInvoices}</p></div>
                    <div><p className="text-muted-foreground">Total gasto</p><p className="font-semibold text-emerald-700">{formatCurrency(sm.totalSpent)}</p></div>
                    <div><p className="text-muted-foreground">Última NF</p><p className="font-semibold text-foreground">{sm.lastDate ? (typeof sm.lastDate === 'string' ? sm.lastDate.slice(0, 10) : new Date(sm.lastDate.seconds ? sm.lastDate.seconds * 1000 : sm.lastDate).toLocaleDateString('pt-BR')) : '-'}</p></div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div><Label>Contato</Label><Input value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} placeholder="Nome do responsável" /></div>
            <div className="form-grid">
              <div><Label>Telefone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            </div>
            <div><Label>Endereço</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Informações adicionais, condições de pagamento, prazo de entrega..." /></div>
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

export default SuppliersPage;
