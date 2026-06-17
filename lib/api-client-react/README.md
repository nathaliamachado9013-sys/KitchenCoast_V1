# @workspace/api-client-react

**⚠️ Este package é auto-gerado.** Não edite manualmente arquivos em `src/generated/`.

React Query hooks gerados automaticamente do OpenAPI spec pelo Orval.

## 🔄 Gerar/Atualizar

```bash
# A partir de lib/api-spec
pnpm --filter @workspace/api-spec run codegen
```

Isso atualiza todos os hooks em `src/generated/`.

## 📖 Como Usar

No seu componente React:

```typescript
import { useHealthCheck, useGetRestaurants } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export function Dashboard() {
  // Fetch data
  const { data, isLoading } = useGetRestaurants();
  
  // Invalidate cache after mutation
  const queryClient = useQueryClient();
  
  return (
    <div>
      {isLoading ? <p>Loading...</p> : <p>{data?.restaurants.length} restaurants</p>}
    </div>
  );
}
```

## 📚 Hooks Disponíveis

Os hooks variam conforme o OpenAPI spec. Exemplos comuns:

- `useHealthCheck()` — GET /api/health
- `useGetRestaurants()` — GET /api/restaurants
- `useCreateRestaurant(options)` — POST /api/restaurants
- `useUpdateRestaurant(id, options)` — PATCH /api/restaurants/{id}
- `useDeleteRestaurant(id, options)` — DELETE /api/restaurants/{id}

## 🔗 Deps

- React Query (TanStack Query)
- Fetch API (built-in)

## 📌 Notas

- **Não edite** `src/generated/` manualmente
- Sempre rode codegen após atualizar `openapi.yaml`
- Hooks seguem padrões React Query padrão

## 📚 Docs

- [React Query Docs](https://tanstack.com/query/latest)
