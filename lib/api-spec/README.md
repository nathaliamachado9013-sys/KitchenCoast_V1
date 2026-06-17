# @workspace/api-spec

Define a **especificação OpenAPI 3.1** da API KitchenCoast e executa **Orval** para gerar código automaticamente.

## 📋 O que faz?

- Define `openapi.yaml` com endpoints, schemas e validações
- Gera React Query hooks em `../api-client-react/src/generated/`
- Gera Zod schemas em `../api-zod/src/generated/`

## 🛠️ Como usar

### Ver a especificação

```bash
# Abrir OpenAPI Spec em editor/visualizer
# Arquivo: openapi.yaml
```

### Rodar codegen (Orval)

Depois de atualizar `openapi.yaml`, rode:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Isso gera:
- ✅ `../api-client-react/src/generated/` — React Query hooks
- ✅ `../api-zod/src/generated/` — Zod schemas

### Exemplo de Hook Gerado

```typescript
// Em api-client-react/src/generated/
import { useHealthCheck } from '@workspace/api-client-react';

// No componente React:
const { data, isLoading } = useHealthCheck();
```

## 📝 Definir um Novo Endpoint

1. Adicionar em `openapi.yaml`:

```yaml
/api/users:
  post:
    tags:
      - Users
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateUserRequest'
    responses:
      '201':
        description: User created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/User'
```

2. Rodar codegen:

```bash
pnpm --filter @workspace/api-spec run codegen
```

3. Hook é gerado automaticamente:

```typescript
import { usePostUsers } from '@workspace/api-client-react';
```

## 🔧 Configuração

Arquivo: `orval.config.ts`

Define como gerar os clientes/schemas a partir do OpenAPI spec.

## 📚 Docs

- [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0)
- [Orval](https://orval.dev/)
