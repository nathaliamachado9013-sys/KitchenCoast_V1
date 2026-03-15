import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  LayoutDashboard,
  ShoppingBasket,
  Truck,
  BookOpen,
  Package,
  BarChart3,
  Settings,
  LogOut,
  ChefHat,
  UtensilsCrossed,
  Wine,
  Factory,
  ShoppingCart,
  DollarSign,
  ReceiptText,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/menu', label: 'Cardápio', icon: UtensilsCrossed },
  { path: '/recipes', label: 'Fichas Técnicas', icon: BookOpen },
  { path: '/resale-products', label: 'Produtos de Revenda', icon: Wine },
  { path: '/ingredients', label: 'Ingredientes', icon: ShoppingBasket },
  { path: '/suppliers', label: 'Fornecedores', icon: Truck },
  { path: '/stock', label: 'Estoque', icon: Package },
  { path: '/production', label: 'Produção', icon: Factory },
  { path: '/sales', label: 'Vendas', icon: ShoppingCart },
  { path: '/purchases', label: 'Compras', icon: ReceiptText },
  { path: '/operational-costs', label: 'Custos Fixos', icon: DollarSign },
  { path: '/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

const Sidebar = () => {
  const { user, restaurant, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="p-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="logo">
          <div className="logo-icon">
            <ChefHat className="w-5 h-5" />
          </div>
          <span className="text-white">KitchenCoast</span>
        </div>
      </div>

      {restaurant && (
        <div className="px-5 py-3 border-b border-[hsl(var(--sidebar-border))]">
          <p className="text-sm font-medium text-white/90 truncate">{restaurant.name}</p>
          <p className="text-xs text-white/50 truncate">{user?.email}</p>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[hsl(var(--sidebar-border))]">
        <button
          onClick={logout}
          className="sidebar-link w-full text-red-400 hover:!bg-red-900/20 hover:!text-red-300"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
