import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Pencil, Trash2, Truck, Phone, Mail, MapPin, FileText } from 'lucide-react';

const emptyForm = { name: '', contactName: '', phone: '', email: '', address: '', notes: '' };

const SuppliersPage = () => {
  const { restaurant } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { if (restaurant?.restaurantId) loadData(); }, [restaurant]);

  const loadData = async () => {
    try {
      const data = await getSuppliers(restaurant.restaurantId);
      setSuppliers(data);
    } catch { toast({ title: 'Erro', description: 'Erro ao carregar fornecedores', variant: 'destructive' }); }
    finally { setLoading(false); }
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
    if (!formData.name) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await updateSupplier(restaurant.restaurantId, editingItem.id, formData);
        toast({ title: 'Fornecedor atualizado!' });
      } else {
        await createSupplier(restaurant.restaurantId, formData);
        toast({ title: 'Fornecedor criado!' });
      }
      setModalOpen(false);
      loadData();
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar fornecedor', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir fornecedor "${item.name}"?`)) return;
    try {
      await deleteSupplier(restaurant.restaurantId, item.id);
      toast({ title: 'Fornecedor excluído!' });
      loadData();
    } catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

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
            <div key={s.id} className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold">{s.name}</h3>
                </div>
                <div className="flex gap-1">
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
