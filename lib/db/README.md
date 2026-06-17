# @workspace/db

Camada de banco de dados usando **Drizzle ORM** com PostgreSQL. Gerencia schema, migrations e queries.

## 📋 Requisitos

- PostgreSQL v14+
- Variável de ambiente: `DATABASE_URL`

## 🛠️ Setup

### 1. Configurar DATABASE_URL

```bash
# .env ou variável de ambiente do sistema
DATABASE_URL="postgresql://user:password@localhost:5432/kitchencost"
```

### 2. Executar migrations

```bash
# Push do schema para o banco
pnpm --filter @workspace/db run push

# Se precisar fazer force-push (dev only)
pnpm --filter @workspace/db run push-force
```

### 3. Gerar tipos do schema

```bash
pnpm --filter @workspace/db run types
```

## 📁 Estrutura

```
src/
├── index.ts           # Exports: pool, db, schema
├── schema/
│   ├── index.ts       # Barrel export de todas as tabelas
│   └── *.ts           # Definição das tabelas (users, restaurants, etc.)
│
└── drizzle.config.ts  # Configuração do Drizzle Kit
```

## 📖 Usar em Outro Package

```typescript
import { db, schema } from '@workspace/db';

// Query de exemplo
const users = await db.select().from(schema.users);
```

## 🔄 Criar uma Nova Tabela

1. Criar arquivo `src/schema/nometabela.ts`:

```typescript
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const restaurants = pgTable('restaurants', {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().defaultNow(),
});
```

2. Exportar em `src/schema/index.ts`:

```typescript
export * from './nometabela';
```

3. Push para o banco:

```bash
pnpm --filter @workspace/db run push
```

## 📚 Docs

- [Drizzle ORM Docs](https://orm.drizzle.team/)
