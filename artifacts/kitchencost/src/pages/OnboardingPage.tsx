import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createRestaurant } from '../lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2 } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '../lib/utils';

const OnboardingPage = () => {
  const { user, refreshRestaurant } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    currency: 'BRL',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome do restaurante é obrigatório', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await createRestaurant(user.uid, {
        ...formData,
        email: user.email,
        displayName: user.displayName || formData.name,
      });
      await refreshRestaurant();
      toast({ title: 'Restaurante criado!', description: 'Bem-vindo ao KitchenCoast!' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao criar restaurante. Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="flex flex-col items-center mb-8">
          <div className="logo-icon mb-3" style={{ width: 52, height: 52, borderRadius: '0.75rem' }}>
            <ChefHat className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">Configure seu restaurante</h1>
          <p className="text-muted-foreground text-sm mt-1">Algumas informações para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do restaurante *</Label>
            <Input
              id="name"
              placeholder="Ex: Restaurante do João"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              placeholder="Rua, número, cidade"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="(11) 99999-9999"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="currency">Moeda</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL — Real Brasileiro (R$)</SelectItem>
                <SelectItem value="EUR">EUR — Euro (€)</SelectItem>
                <SelectItem value="USD">USD — Dólar Americano ($)</SelectItem>
                <SelectItem value="GBP">GBP — Libra Esterlina (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar meu restaurante
          </Button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
