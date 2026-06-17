# KitchenCoast — Frontend

App React para gestão de custos e margens em restaurantes. Interface responsiva com dashboard em tempo real, controle de estoque e análises de rentabilidade.

**🔗 Acesse:** [kitchencost-e1a2e.web.app/dashboard](https://kitchencost-e1a2e.web.app/dashboard)

## 🛠️ Tech Stack

- **React 19** — Framework UI
- **Vite** — Build tool (dev server rápido)
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **shadcn/ui** — UI components
- **React Query** — Data fetching e state
- **React Hook Form** — Form management
- **Zod** — Form validation
- **React Router** — Routing
- **Firebase** — Auth e Firestore
- **Recharts** — Gráficos

## 📋 Requisitos

- Node.js v24+
- pnpm v9+
- Firebase Project com Auth e Firestore ativados

## 🚀 Como Instalar

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Preencha as variáveis Firebase:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Rodar em desenvolvimento

```bash
pnpm run dev
```

Acesse `http://localhost:5173` no navegador.

## 🏗️ Estrutura de Pastas

```
src/
├── components/          # Componentes React
│   ├── ui/             # Componentes shadcn/ui (botões, cards, etc.)
│   └── ...             # Features components
│
├── pages/              # Rotas/páginas principais
│
├── hooks/              # Custom React hooks
│
├── lib/
│   ├── utils.ts        # Utilitários gerais
│   └── api.ts          # Configuração Firebase/API
│
├── types/              # TypeScript types e interfaces
│
├── App.tsx             # Root component
│
└── main.tsx            # Entry point
```

## 🔐 Autenticação

- Firebase Authentication com Google e Email/Senha
- Cada usuário só vê dados do seu próprio restaurante (Firestore rules)

## 📦 Build para Produção

```bash
pnpm run build
```

Output em `dist/public/`.

## 🚀 Deploy no Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

## 🧪 Type Checking

```bash
pnpm run typecheck
```

## 📚 Documentação

Veja o [README principal](../../README.md) para mais detalhes da stack completa.
