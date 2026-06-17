# KitchenCoast

Um sistema SaaS completo de **gestão de custos e margens** para restaurantes. Controle suas receitas, estoque, produção e rentabilidade em tempo real.

**🔗 Acesse aqui:** [kitchencost-e1a2e.web.app/dashboard](https://kitchencost-e1a2e.web.app/dashboard)

## ✨ Funcionalidades

- **Dashboard** — Métricas em tempo real com gráficos de rentabilidade
- **Fichas Técnicas** — Calculadora de custo por prato com margem
- **Cardápio** — Engenharia de menu com rentabilidade por item
- **Estoque** — Controle de inventário com alertas de estoque baixo
- **Produção** — Cálculo de custo pelos preços atuais
- **Vendas** — Rastreamento por canal (balcão, delivery, iFood, etc.)
- **Relatórios** — Análise de rentabilidade e margens
- **Custos Fixos** — Custos mensais que afetam automaticamente as receitas
- **Autenticação** — Login com Google e email/senha

## 🛠️ Tech Stack

| Layer | Tecnologia |
|-------|------------|
| **Frontend** | React 19 + Vite + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | React Query (TanStack Query) |
| **Backend** | Express 5 + Node.js |
| **Database** | PostgreSQL + Drizzle ORM |
| **API** | OpenAPI 3.1 + Orval (codegen) |
| **Validação** | Zod v4 |
| **Auth** | Firebase Authentication |
| **Database NoSQL** | Firestore |
| **Hosting** | Firebase Hosting + Cloud Run |

## 📁 Estrutura do Projeto

```
KitchenCoast_V1/
├── artifacts/                    # Aplicações deployáveis
│   ├── api-server/              # API Express (Node.js)
│   ├── kitchencost/             # App React (Frontend)
│   └── mockup-sandbox/          # Sandbox de componentes UI
│
├── lib/                         # Bibliotecas compartilhadas
│   ├── db/                      # Drizzle ORM + schema PostgreSQL
│   ├── api-spec/                # OpenAPI spec + Orval config
│   ├── api-zod/                 # Schemas Zod gerados
│   └── api-client-react/        # React Query hooks gerados
│
├── scripts/                     # Utilitários TypeScript
│
├── pnpm-workspace.yaml          # Monorepo config
└── tsconfig.base.json           # Shared TypeScript config
```

## 📋 Requisitos de Sistema

- **Node.js** v24+
- **pnpm** v9+
- **PostgreSQL** v14+
- **Firebase Project** (para auth e hosting)

## 🚀 Como Instalar e Rodar

### 1. Clonar o repositório

```bash
git clone https://github.com/nathaliamachado9013-sys/KitchenCoast_V1.git
cd KitchenCoast_V1
```

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Configurar variáveis de ambiente

**Frontend** — Copiar e preencher `.env`:
```bash
cd artifacts/kitchencost
cp .env.example .env
# Editar .env com suas chaves Firebase
```

**Backend** — Copiar e preencher `.env`:
```bash
cd artifacts/api-server
cp .env.example .env
# Configurar DATABASE_URL, PORT, etc.
```

### 4. Rodar localmente (desenvolvimento)

**Terminal 1 — API Server:**
```bash
pnpm --filter @workspace/api-server run dev
# API rodando em http://localhost:8080/api
```

**Terminal 2 — Frontend:**
```bash
cd artifacts/kitchencost
pnpm run dev
# App rodando em http://localhost:5173
```

**Terminal 3 — Mockup Sandbox (opcional):**
```bash
cd artifacts/mockup-sandbox
pnpm run dev
# Sandbox rodando em http://localhost:5173
```

### 5. Build para Produção

```bash
# Typecheck + build all packages
pnpm run build

# Buildar apenas frontend
pnpm --filter @workspace/kitchencost run build
```

## 🚢 Deployment

### Frontend (Firebase Hosting)

```bash
cd artifacts/kitchencost
npm run build
firebase deploy --only hosting
```

### Backend (Pode rodar em Cloud Run, Heroku, VPS, etc.)

```bash
# Build para produção
pnpm --filter @workspace/api-server run build

# Docker pode ser usado
docker build -t kitchencost-api .
docker run -p 8080:8080 kitchencost-api
```

## 🔐 Segurança

- **Firestore Rules**: Cada usuário só acessa dados do seu próprio restaurante
- **Autenticação**: Firebase Auth com providers Google e email/senha
- **Validação**: Zod schemas em todas as requisições da API
- **CORS**: Configurado apenas para domínios autorizados

## 📚 Documentação Adicional

- **[API Server](artifacts/api-server/README.md)** — Detalhes da API Express
- **[Frontend](artifacts/kitchencost/README.md)** — Instruções do app React
- **[Database](lib/db/README.md)** — Setup PostgreSQL e migrations
- **[API Spec](lib/api-spec/README.md)** — OpenAPI e codegen

## 🤝 Contribuir

Contribuições são bem-vindas! Por favor:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para detalhes.

## 💬 Suporte

Encontrou um bug ou tem uma sugestão? Abra uma [issue](https://github.com/nathaliamachado9013-sys/KitchenCoast_V1/issues) no GitHub.

---

**Desenvolvido com ❤️ por Nathália Machado**
