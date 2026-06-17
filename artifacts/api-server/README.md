# @workspace/api-server

API REST com Express 5 + Node.js. Backend do KitchenCoast que gerencia restaurants, estoque, produção e vendas.

## 🛠️ Tech Stack

- **Express 5** — Web framework
- **PostgreSQL + Drizzle ORM** — Database
- **Zod** — Request/response validation
- **TypeScript** — Type safety
- **Node.js 24+** — Runtime

## 📋 Requisitos

- Node.js v24+
- pnpm v9+
- PostgreSQL v14+ rodando
- Variável `DATABASE_URL` configurada

## 🚀 Como Rodar

### 1. Configurar ambiente

```bash
cp .env.example .env
```

Preencha:
```
PORT=8080
DATABASE_URL=postgresql://user:password@localhost:5432/kitchencost
NODE_ENV=development
```

### 2. Instalar dependências (a partir da raiz)

```bash
pnpm install
```

### 3. Rodar em desenvolvimento

```bash
pnpm --filter @workspace/api-server run dev
```

Servidor rodando em `http://localhost:8080`

### 4. Testar

```bash
curl http://localhost:8080/api/health
```

Resposta esperada:
```json
{"status": "ok"}
```

## 📁 Estrutura

```
src/
├── index.ts          # Entry point + servidor Express
├── app.ts            # Setup middleware (CORS, JSON, rotas)
├── routes/
│   ├── index.ts      # Router principal
│   ├── health.ts     # GET /health
│   └── ...           # Outras rotas
│
└── types/            # TypeScript types
```

## 🔌 Endpoints

Endpoints disponíveis conforme o OpenAPI spec. Alguns exemplos:

- `GET /api/health` — Health check
- `GET /api/restaurants` — Listar restaurants
- `POST /api/restaurants` — Criar restaurant
- `GET /api/restaurants/:id` — Detalhe restaurant

Veja a especificação completa em [`../lib/api-spec/openapi.yaml`](../../lib/api-spec/openapi.yaml).

## 🛣️ Como Adicionar uma Rota

1. Criar novo arquivo em `src/routes/nomerota.ts`:

```typescript
import { Router } from 'express';
import { db, schema } from '@workspace/db';
import { CreateRestaurantSchema } from '@workspace/api-zod';

const router = Router();

router.post('/restaurants', async (req, res) => {
  try {
    const body = CreateRestaurantSchema.parse(req.body);
    
    const result = await db.insert(schema.restaurants).values(body).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

2. Montar em `src/routes/index.ts`:

```typescript
import restaurantRoutes from './restaurants';

router.use('/restaurants', restaurantRoutes);
```

## 🔐 Segurança

- Validação com Zod em todos os endpoints
- CORS configurado
- SQL injection proteção (Drizzle ORM prepared statements)
- Rate limiting (opcional, adicionar conforme necessário)

## 📦 Build para Produção

```bash
pnpm --filter @workspace/api-server run build
```

Output em `dist/index.cjs`.

## 🚀 Deploy

### Docker

```dockerfile
FROM node:24-alpine
WORKDIR /app

COPY pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.cjs"]
```

### Cloud Run (Google Cloud)

```bash
gcloud run deploy kitchencost-api \
  --source . \
  --region us-central1 \
  --set-env-vars="DATABASE_URL=postgresql://..." \
  --allow-unauthenticated
```

## 📚 Documentação

- [Express Docs](https://expressjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod](https://zod.dev/)
