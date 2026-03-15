import React, { useState, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useAuth } from '../contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, Mail } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const LoginPage = () => {
  const { loginWithEmail, loginWithGoogle, registerWithEmail } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { toast } = useToast();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (executeRecaptcha) {
        await executeRecaptcha(mode === 'login' ? 'login' : 'register').catch(() => {});
      }
      if (mode === 'login') {
        await loginWithEmail(formData.email, formData.password);
      } else {
        await registerWithEmail(formData.email, formData.password, formData.name);
      }
    } catch (error) {
      console.error('Auth error:', error?.code, error?.message);
      const code = error?.code || '';
      const msg =
        code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Email ou senha incorretos'
          : code === 'auth/email-already-in-use'
          ? 'Este email já está em uso'
          : code === 'auth/weak-password'
          ? 'A senha deve ter pelo menos 6 caracteres'
          : code === 'auth/too-many-requests'
          ? 'Muitas tentativas. Aguarde alguns minutos.'
          : code === 'auth/network-request-failed'
          ? 'Erro de rede. Verifique sua conexão.'
          : code
          ? `Erro: ${code}`
          : 'Erro desconhecido. Tente novamente.';
      toast({ title: 'Erro de autenticação', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [executeRecaptcha, mode, formData, loginWithEmail, registerWithEmail, toast]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // onAuthStateChanged in AuthContext handles the rest
    } catch (error) {
      console.error('Google sign-in error:', error?.code, error?.message);
      const code = error?.code || '';
      const msg =
        code === 'auth/popup-blocked'
          ? 'Popup bloqueado pelo browser. Permita popups para este site e tente novamente.'
          : code === 'auth/popup-closed-by-user'
          ? 'Login cancelado. Feche o popup do Google antes de tentar novamente.'
          : code === 'auth/cancelled-popup-request'
          ? 'Já existe um popup aberto. Aguarde ou recarregue a página.'
          : code === 'auth/network-request-failed'
          ? 'Erro de rede. Verifique sua conexão.'
          : code === 'auth/firebase-app-check-token-is-invalid'
          ? 'Erro de segurança (App Check). Recarregue a página e tente novamente.'
          : code
          ? `Erro Google: ${code}`
          : 'Não foi possível fazer login com Google. Tente novamente.';
      toast({
        title: 'Erro no login com Google',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="flex flex-col items-center mb-8">
          <div className="logo-icon mb-3" style={{ width: 52, height: 52, borderRadius: '0.75rem' }}>
            <ChefHat className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">KitchenCoast</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão inteligente para sua cozinha</p>
        </div>

        <Button
          variant="outline"
          className="w-full mb-2 gap-3 h-11"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
          {googleLoading ? 'Aguardando Google...' : 'Continuar com Google'}
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-muted-foreground">ou com email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-primary font-medium hover:underline"
          >
            {mode === 'login' ? 'Criar conta grátis' : 'Entrar'}
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Protegido por reCAPTCHA v3
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
