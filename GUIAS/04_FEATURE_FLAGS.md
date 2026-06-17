# 4️⃣ Feature Flags

## O que é Feature Flag?

**Feature Flag** = Botão ON/OFF para ativar/desativar features SEM fazer novo deploy

### Antes (Sem Feature Flags)
```
1. Você programa nova feature
2. Testa localmente
3. Faz deploy em produção
4. Todos os usuários usam (10,000 usuários!)
5. Descobre um bug
6. Todos têm o bug! 😱
7. Precisa fazer rollback (demora 30 min)
```

### Depois (Com Feature Flags)
```
1. Você programa nova feature
2. Testa localmente
3. Faz deploy com feature flag OFF
4. Ativa para 5% dos usuários (50 usuários)
5. Descobre um bug
6. Desativa flag instantaneamente
7. Problema resolvido em 10 segundos! ✨
```

---

## Criar Feature Flag

### Método 1: Firebase Console (Mais Fácil)

**Passo 1: Abra Firebase Console**
```
https://console.firebase.google.com
```

**Passo 2: Selecione seu projeto**
```
KitchenCoast (seu projeto)
```

**Passo 3: Abra Firestore Database**
```
Esquerda: Firestore Database → Clique
```

**Passo 4: Crie collection "feature_flags"**

```
Firestore view:
┌─ Collections ──────────────────────┐
│ + Start Collection                 │ ← Clique aqui
└────────────────────────────────────┘

Preencha:
┌─ Create Collection ────────────────┐
│ Collection ID:                     │
│ [feature_flags]                    │
└────────────────────────────────────┘

Clique: "Next"
```

**Passo 5: Dentro de feature_flags, adicione documento**

```
ID do documento: new-profit-calc
(ou outro nome único)

Campos a adicionar:
```

| Field | Type | Value |
|-------|------|-------|
| name | string | new-profit-calc |
| enabled | boolean | false |
| rolloutPercentage | number | 0 |
| description | string | Novo cálculo com ops costs |
| whitelistedUsers | array | [] |
| blacklistedUsers | array | [] |
| createdAt | timestamp | Agora |
| updatedAt | timestamp | Agora |

Clique: "Save"

**Resultado no Firebase:**
```
┌─ Firestore ─────────────────────────┐
│ Collections:                        │
│ └─ feature_flags                    │
│    └─ new-profit-calc               │
│       ├─ name: "new-profit-calc"   │
│       ├─ enabled: false            │
│       ├─ rolloutPercentage: 0      │
│       └─ ...                       │
└─────────────────────────────────────┘
```

### Método 2: Código (Firefox Console)

Mais rápido se souber programar.

No browser (F12 → Console):

```javascript
import { createFeatureFlag } from './src/lib/featureFlags';

createFeatureFlag('seu-restaurant-id', 'new-profit-calc', {
  enabled: false,
  rolloutPercentage: 0,
  description: 'Novo cálculo de lucro'
});
```

---

## Usar Feature Flag em Componente

### Exemplo: SalesPage com nova calculadora

**Arquivo: `artifacts/kitchencost/src/pages/SalesPage.jsx`**

**Passo 1: Importe o hook**

No topo do arquivo, procure por imports. Adicione:

```javascript
import { useFeatureFlag } from '../hooks/useFeatureFlag';
```

**Passo 2: Use o hook no componente**

Dentro da função `SalesPage`:

```javascript
const SalesPage = () => {
  const { restaurant, user } = useAuth();
  
  // 👇 Adicione estas linhas
  const { isEnabled: useNewProfitCalc } = useFeatureFlag(
    'new-profit-calc',
    restaurant.restaurantId,
    user.id
  );
  
  // Resto do código...
};
```

**Passo 3: Use a flag na lógica**

Procure na função `handleSubmit`:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    let profit;
    
    // 👇 Adicione isto
    if (useNewProfitCalc) {
      // ✨ NOVO CÓDIGO
      const actualCost = baseCost + operationalCostPerDish;
      profit = (salePrice - actualCost) * quantitySold;
    } else {
      // 🔄 CÓDIGO ANTIGO
      profit = (salePrice - baseCost) * quantitySold;
    }
    
    // Continua com o resto...
    await createSale(restaurant.restaurantId, {
      // ... dados da venda
      profit: profit  // Usar valor calculado
    });
    
  } catch (error) {
    toast({ title: 'Erro', description: error.message });
  }
};
```

**Salve:** Ctrl + S

---

## Ativar Gradualmente (Rollout)

### Timeline Recomendada

#### **Dia 1: Teste Interno**

```
Firebase Console → feature_flags → new-profit-calc

Edite:
├─ enabled: false
└─ whitelistedUsers: ["seu-user-id"]

Significado: Só você usa a nova feature
Teste: Cria vendas, verifica se cálculo está correto
```

**Como fazer:**

1. Firebase Console
2. Collections → feature_flags → new-profit-calc
3. Clique em documento
4. Clique "Edit field"
5. Mude valor
6. Clique "Update"

#### **Dia 2: Ativa para você e time**

```
Edite:
├─ enabled: true
└─ whitelistedUsers: ["seu-id", "gerente1-id", "gerente2-id"]

Significado: 3 pessoas testam
Teste: Tudo funciona bem?
```

#### **Dia 3: Rollout 5%**

```
Edite:
├─ enabled: true
├─ rolloutPercentage: 5
└─ whitelistedUsers: []  (Remova)

Significado: ~5% dos usuários (~50 usuários)
Monitorar: Erros no Sentry? Taxa de sucesso?
```

**Como ver quem tem flag ativada:**

```javascript
// Console do browser

import { isFeatureFlagEnabled } from './src/lib/featureFlags';

// Ver se VOCÊ tem
const iEnabled = await isFeatureFlagEnabled(
  'seu-restaurant-id',
  'new-profit-calc',
  'seu-user-id'
);
console.log('Tenho novo cálculo?', iEnabled); // true ou false
```

#### **Dia 4-5: Aumentar Gradualmente**

```
Dia 4:
├─ rolloutPercentage: 25  (25%)

Dia 5:
├─ rolloutPercentage: 50  (50%)

Dia 6:
├─ rolloutPercentage: 100  (100%)
└─ todos os usuários agora usam
```

---

## Desativar de Emergência

### Se descobrir BUG durante rollout

**Passo 1: Vá para Firebase Console**

Collections → feature_flags → new-profit-calc

**Passo 2: Clique "Edit field" em "enabled"**

Mude: `true` → `false`

**Passo 3: Clique "Update"**

**Pronto! Todos param de usar em 30 segundos!**

---

## Exemplos Práticos

### Exemplo 1: A/B Testing UI

Testar se nova interface converte mais vendas.

```javascript
// MenuPage.jsx
import { useFeatureFlag } from '../hooks/useFeatureFlag';

const MenuPage = () => {
  const { restaurant, user } = useAuth();
  
  // Ativa novo UI para 50% dos usuários
  const { isEnabled: useNewUI } = useFeatureFlag(
    'new-menu-ui',
    restaurant.restaurantId,
    user.id
  );

  return (
    <>
      {useNewUI ? (
        <NewMenuLayout /> {/* Nova interface (cores, botões diferentes) */}
      ) : (
        <OldMenuLayout /> {/* Interface antiga */}
      )}
    </>
  );
};
```

**Rastreiar conversão:**

```javascript
// Em ambo os layouts
import { addBreadcrumb } from '../lib/sentry';

const NewMenuLayout = () => {
  useEffect(() => {
    addBreadcrumb('User viewing new menu UI', 'feature-flag');
  }, []);

  const handleBuy = async () => {
    addBreadcrumb('Sale via new UI', 'feature-flag');
    // ... criar venda
  };
};
```

**No Sentry:**
- Vê qual UI levou a mais vendas
- Qual teve mais erros
- Qual teve mais usuários

### Exemplo 2: Feature para Admin Apenas

Ativar recurso avançado só para gerenciador.

```javascript
// RecipesPage.jsx

const { isEnabled: useAdvancedAnalytics } = useFeatureFlag(
  'advanced-recipe-analysis',
  restaurant.restaurantId,
  user.id
);

return (
  <>
    <RecipesTable recipes={recipes} />
    
    {/* Mostra só se flag ativado E usuário é admin */}
    {useAdvancedAnalytics && user.role === 'admin' && (
      <AdvancedCostAnalysis recipe={selectedRecipe} />
    )}
  </>
);
```

### Exemplo 3: Desativar Feature em Erro

Desativar automaticamente se houver muitos erros.

```javascript
// Dashboard.jsx
const Dashboard = () => {
  const { isEnabled: useRealTime } = useFeatureFlag(
    'real-time-updates',
    restaurantId,
    userId
  );

  const [rtError, setRtError] = useState(false);

  useEffect(() => {
    if (useRealTime) {
      try {
        setupRealTimeListeners(); // Issue #9
      } catch (error) {
        setRtError(true);
        // Sentry recebe erro com contexto
        captureException(error, {
          feature_flag: 'real-time-updates',
          severity: 'high'
        });
      }
    }
  }, [useRealTime]);

  if (rtError) {
    return <Alert>Atualizações em tempo real indisponíveis</Alert>;
  }

  return <Dashboard />;
};
```

---

## Monitorar com Sentry

### Correlacionar Erro com Feature Flag

```javascript
// Quando erro acontece, envia contexto
import { captureException } from '../lib/sentry';

const handleSale = async () => {
  try {
    const { isEnabled } = useFeatureFlag('new-profit-calc', ...);
    
    // ... lógica venda
  } catch (error) {
    // Envia contexto do erro
    captureException(error, {
      feature_flag: 'new-profit-calc',
      flag_enabled: isEnabled,
      user_id: user.id,
      timestamp: new Date()
    });
  }
};
```

**No Sentry:**
```
🔴 TypeError: Cannot read property 'cost'
└─ Context:
   ├─ feature_flag: "new-profit-calc"
   ├─ flag_enabled: true  ← Ah! Novo código ativado
   └─ Solução: Arruma o novo código
```

---

## Troubleshooting

### Problema 1: Feature flag não aparece no componente

```
Componente continua com código antigo mesmo com flag true
```

**Solução:**

1. Verifica se `isEnabled` está em cache
2. Recarrega página (F5)
3. Abre DevTools (F12) → Network
4. Se não vê requisição Firestore, problema no hook

```javascript
// Debug: Console do browser
import { isFeatureFlagEnabled } from './src/lib/featureFlags';

const result = await isFeatureFlagEnabled(
  'seu-restaurant-id',
  'new-profit-calc',
  'seu-user-id'
);
console.log('Flag habilitada?', result); // true ou false
```

### Problema 2: Não consegue criar collection

```
Erro: "Permission denied"
```

**Solução:**

1. Firebase Console → Firestore Rules
2. Mude regra:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /restaurants/{restaurantId}/feature_flags/{document=**} {
      allow read, write: if true;  // ← Permite criar
    }
  }
}
```

3. Publica règras (Publish button)

### Problema 3: Flag não afeta usuários após 30s

Às vezes leva um pouco.

**Solução:**

1. Recarrega app (F5)
2. Abre console: testa `isFeatureFlagEnabled`
3. Se continuar false, verifica se rolloutPercentage > 0

---

## 📋 Checklist: Feature Flags Funcionando

- [ ] Criei collection "feature_flags" no Firebase
- [ ] Criei documento "new-profit-calc"
- [ ] Importei `useFeatureFlag` no componente
- [ ] Testei localmente com flag
- [ ] Adicionei lógica condicional
- [ ] Testei com flag true/false
- [ ] Comecei rollout por 5%
- [ ] Monitorei Sentry por 1 dia
- [ ] Aumentei rollout gradualmente

---

## 🔗 Links

- [Feature Flags Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [React Hooks](https://react.dev/reference/react)
