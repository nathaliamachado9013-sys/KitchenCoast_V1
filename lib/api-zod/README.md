# @workspace/api-zod

**⚠️ Este package é auto-gerado.** Não edite manualmente arquivos em `src/generated/`.

Zod schemas gerados automaticamente do OpenAPI spec pelo Orval. Usados no backend para validação de requests.

## 🔄 Gerar/Atualizar

```bash
# A partir de lib/api-spec
pnpm --filter @workspace/api-spec run codegen
```

Isso atualiza todos os schemas em `src/generated/`.

## 📖 Como Usar

No seu backend Express:

```typescript
import { HealthCheckResponseSchema } from '@workspace/api-zod';
import { db } from '@workspace/db';

app.get('/api/restaurants', async (req, res) => {
  const restaurants = await db.select().from(schema.restaurants);
  
  // Schema valida a resposta antes de enviar
  const validated = HealthCheckResponseSchema.parse(restaurants);
  res.json(validated);
});
```

## 📋 Schemas Gerados

Os schemas variam conforme o OpenAPI spec. Exemplos:

- `HealthCheckResponseSchema` — GET /api/health response
- `CreateRestaurantRequestSchema` — POST /api/restaurants request
- `RestaurantSchema` — Restaurant data model

## 📌 Notas

- **Não edite** `src/generated/` manualmente
- Sempre rode codegen após atualizar `openapi.yaml`
- Use para validar requests e responses

## 📚 Docs

- [Zod Docs](https://zod.dev)
