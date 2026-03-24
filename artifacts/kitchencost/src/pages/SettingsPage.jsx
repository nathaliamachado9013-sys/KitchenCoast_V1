import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/useAuth';
import { updateRestaurant, getMenuCategories, createMenuCategory, updateMenuCategory, deleteMenuCategory } from '../lib/firestore';
import { SUPPORTED_CURRENCIES } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Building, Calculator, Tag, Plus, Pencil, Trash2, ChevronRight, ShieldAlert, AlertTriangle } from 'lucide-react';

const CURRENCY_LABELS = { BRL: 'BRL — Real Brasileiro (R$)', EUR: 'EUR — Euro (€)', USD: 'USD — Dólar Americano ($)', GBP: 'GBP — Libra Esterlina (£)' };

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, restaurant, updateRestaurant: updateRestaurantCtx, refreshRestaurant, deleteAccount, isOwner } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', currency: 'BRL' });

  // Account deletion state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isGoogleUser = user?.providerData?.[0]?.providerId === 'google.com';

  useEffect(() => {
    if (restaurant) {
      setFormData({ name: restaurant.name || '', address: restaurant.address || '', phone: restaurant.phone || '', currency: restaurant.currency || 'BRL' });
      loadCategories();
    }
  }, [restaurant]);

  const loadCategories = async () => {
    try { setCategories(await getMenuCategories(restaurant.restaurantId)); }
    catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await updateRestaurant(restaurant.restaurantId, formData);
      updateRestaurantCtx(formData);
      toast({ title: 'Configurações salvas!' });
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar configurações', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const openCategoryModal = (cat = null) => {
    setEditingCategory(cat);
    setNewCategoryName(cat?.name || '');
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) { toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' }); return; }
    setSavingCategory(true);
    try {
      if (editingCategory) { await updateMenuCategory(restaurant.restaurantId, editingCategory.id, { name: newCategoryName }); toast({ title: 'Categoria atualizada!' }); }
      else { await createMenuCategory(restaurant.restaurantId, newCategoryName); toast({ title: 'Categoria criada!' }); }
      setCategoryModalOpen(false);
      loadCategories();
    } catch { toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSavingCategory(false); }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Excluir categoria "${cat.name}"?`)) return;
    try { await deleteMenuCategory(restaurant.restaurantId, cat.id); toast({ title: 'Categoria excluída!' }); loadCategories(); }
    catch { toast({ title: 'Erro', description: 'Erro ao excluir', variant: 'destructive' }); }
  };

  const openDeleteModal = () => {
    setDeleteEmail('');
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'EXCLUIR') {
      toast({ title: 'Confirmação necessária', description: 'Digite EXCLUIR para confirmar.', variant: 'destructive' });
      return;
    }
    if (!isGoogleUser && (!deleteEmail.trim() || !deletePassword.trim())) {
      toast({ title: 'Preencha email e senha para confirmar', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({ email: deleteEmail, password: deletePassword });
      navigate('/login');
    } catch (err) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Credenciais incorretas. Verifique email e senha.'
        : err.message || 'Erro ao excluir conta.';
      toast({ title: 'Erro ao excluir conta', description: msg, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Configurações">
      <div className="max-w-2xl space-y-6">
        {/* Restaurant data */}
        <div className="bg-card rounded-xl border p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Building className="w-4 h-4" />Dados do Restaurante</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div><Label>Nome do restaurante *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div><Label>Endereço</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
            <div className="form-grid">
              <div><Label>Telefone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div>
                <Label>Moeda</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{CURRENCY_LABELS[c] || c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </form>
        </div>

        {/* Menu categories */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4" />Categorias do Cardápio</h2>
            <Button size="sm" onClick={() => openCategoryModal()}><Plus className="w-4 h-4 mr-2" />Nova</Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma categoria criada ainda</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                  <span className="font-medium text-sm">{cat.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openCategoryModal(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDeleteCategory(cat)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operational costs link */}
        <div className="bg-card rounded-xl border p-4 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate('/operational-costs')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Calculator className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="font-semibold">Custos Fixos Mensais</p>
                <p className="text-sm text-muted-foreground">Aluguel, energia, salários e outros custos operacionais</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* ── DANGER ZONE ── */}
        {isOwner && (
          <div className="bg-card rounded-xl border border-red-200 p-6">
            <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Zona de Perigo
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              A exclusão da conta é permanente e irreversível. Todos os dados da empresa serão apagados definitivamente.
            </p>
            <Button variant="destructive" size="sm" onClick={openDeleteModal}>
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir minha conta
            </Button>
          </div>
        )}
      </div>

      {/* Category modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Nome</Label><Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ex: Pratos Principais" /></div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveCategory} disabled={savingCategory}>{savingCategory && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingCategory ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE ACCOUNT MODAL ── */}
      <Dialog open={deleteModalOpen} onOpenChange={v => { if (!deleting) setDeleteModalOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Excluir conta permanentemente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Warning block */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
              <p className="font-semibold">Esta ação é irreversível. Serão apagados permanentemente:</p>
              <ul className="space-y-0.5 ml-4 list-disc text-red-700">
                <li>Ingredientes, receitas e fornecedores</li>
                <li>Todo o histórico de notas fiscais e movimentos de estoque</li>
                <li>Vendas, produções e relatórios</li>
                <li>A sua conta de utilizador</li>
              </ul>
              <p className="text-xs text-red-600 mt-2">
                Nota: arquivos de imagem de notas fiscais ficam na nossa CDN e serão removidos em ciclo de limpeza automático.
              </p>
            </div>

            {/* Credentials */}
            {isGoogleUser ? (
              <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                A sua conta usa Google. Uma janela de reautenticação será aberta ao confirmar.
              </div>
            ) : (
              <>
                <div>
                  <Label>Seu email de acesso</Label>
                  <Input
                    type="email"
                    value={deleteEmail}
                    onChange={e => setDeleteEmail(e.target.value)}
                    placeholder="seu@email.com"
                    disabled={deleting}
                  />
                </div>
                <div>
                  <Label>Sua senha</Label>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Digite sua senha"
                    disabled={deleting}
                  />
                </div>
              </>
            )}

            {/* Confirm by typing */}
            <div>
              <Label>
                Para confirmar, digite <strong className="text-red-600">EXCLUIR</strong> abaixo:
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="EXCLUIR"
                disabled={deleting}
                className={deleteConfirmText === 'EXCLUIR' ? 'border-red-400' : ''}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'EXCLUIR'}
              >
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Excluindo...</>
                  : <><Trash2 className="w-4 h-4 mr-2" />Excluir conta permanentemente</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SettingsPage;
