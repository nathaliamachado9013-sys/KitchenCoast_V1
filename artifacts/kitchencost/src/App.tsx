import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';

import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import Dashboard from './pages/Dashboard';
import IngredientsPage from './pages/IngredientsPage';
import SuppliersPage from './pages/SuppliersPage';
import RecipesPage from './pages/RecipesPage';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import OperationalCostsPage from './pages/OperationalCostsPage';
import MenuPage from './pages/MenuPage';
import ResaleProductsPage from './pages/ResaleProductsPage';
import ProductionPage from './pages/ProductionPage';
import SalesPage from './pages/SalesPage';
import PurchasesPage from './pages/PurchasesPage';

const RECAPTCHA_SITE_KEY = '6Lcgb4ssAAAAAC4lOhF3eTlXFC5zrjuuIIXmhK3v';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, restaurant, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!restaurant && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (restaurant && location.pathname === '/onboarding') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const AppRouter = () => {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading ? <LoadingScreen /> : isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/ingredients" element={<ProtectedRoute><IngredientsPage /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
      <Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
      <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/operational-costs" element={<ProtectedRoute><OperationalCostsPage /></ProtectedRoute>} />
      <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
      <Route path="/resale-products" element={<ProtectedRoute><ResaleProductsPage /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute><ProductionPage /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><PurchasesPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY} language="pt-BR">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </GoogleReCaptchaProvider>
  );
}

export default App;
