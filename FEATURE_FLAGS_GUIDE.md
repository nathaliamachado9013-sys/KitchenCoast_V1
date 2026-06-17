# 🚩 Guia de Feature Flags - KitchenCoast

## O que é?

Feature Flags permitem ativar/desativar features SEM fazer novo deploy. Útil para:
- ✅ Rollout gradual (10% → 25% → 50% → 100%)
- ✅ A/B testing (compara versão velha vs nova)
- ✅ Rollback instantâneo (desativa flag se houver erro)
- ✅ Testes de produção (ativa só para você antes de liberar)

---

## Como Usar

### 1. Usar Feature Flag em um Componente

```javascript
// SalesPage.jsx
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { useAuth } from '../contexts/AuthContext';

const SalesPage = () => {
  const { restaurant, user } = useAuth();
  const { isEnabled: useNewProfitCalc } = useFeatureFlag(
    'new-profit-calc',
    restaurant.restaurantId,
    user.id
  );

  const handleSale = async () => {
    let profit;

    if (useNewProfitCalc) {
      // ✨ Novo código (com op costs)
      const actualCost = baseCost + operationalCostPerDish;
      profit = (salePrice - actualCost) * quantity;
    } else {
      // 🔄 Código antigo (sem op costs)
      profit = (salePrice - baseCost) * quantity;
    }

    // Continuar lógica...
  };

  return (
    // seu JSX aqui
  );
};

export default SalesPage;
```

### 2. Ativar Feature Flag (Admin)

**Local**: Dashboard → Configurações → Feature Flags (criar página)

```javascript
// SettingsPage.jsx ou nova FeatureFlagsPage.jsx
import { createFeatureFlag, updateFlagRollout, setFlagEnabled } from '../lib/featureFlags';

// Criar nova flag
const handleCreateFlag = async () => {
  await createFeatureFlag(restaurantId, 'new-profit-calc', {
    enabled: false, // Começa desativado
    rolloutPercentage: 0,
    description: 'Novo cálculo de lucro incluindo custos operacionais',
  });
};

// Iniciar rollout gradual
const handleStartRollout = async () => {
  await updateFlagRollout(restaurantId, 'new-profit-calc', 5); // 5% dos usuários
};

// Depois ativa para mais usuários
await updateFlagRollout(restaurantId, 'new-profit-calc', 25); // 25%
await updateFlagRollout(restaurantId, 'new-profit-calc', 50); // 50%
await updateFlagRollout(restaurantId, 'new-profit-calc', 100); // 100% (todos)

// Desativar se der erro
await setFlagEnabled(restaurantId, 'new-profit-calc', false);
```

### 3. Usar Flag no Firestore (Lógica no Backend)

```javascript
// firestore.js
import { isFeatureFlagEnabled } from './featureFlags';

export const createSale = async (restaurantId, data, recipes, opCostPerDish, userId) => {
  // Verificar se usar novo cálculo
  const useNewProfitCalc = await isFeatureFlagEnabled(
    restaurantId,
    'new-profit-calc',
    userId
  );

  let profit;
  if (useNewProfitCalc) {
    const actualCost = cost + opCostPerDish;
    profit = (salePrice - actualCost) * data.quantitySold;
  } else {
    profit = (salePrice - cost) * data.quantitySold;
  }

  // Salvar venda com novo/antigo cálculo
  // ...
};
```

---

## 🎯 Roteiro de Rollout Recomendado

### Dia 1: Setup Inicial
```
rolloutPercentage = 0
enabled = false
(Ninguém usa, testa internamente)
```

### Dia 2-3: Teste Interno
```
rolloutPercentage = 0
enabled = true
whitelistedUsers = ['seu-user-id']
(Só você testa)
```

### Dia 4: Rollout Baixo
```
rolloutPercentage = 5
enabled = true
(5% dos usuários, ~1-2 usuários)
```

**Monitorar**: Erros no Sentry? Taxa de sucesso?

### Dia 5: Aumentar Gradualmente
```
rolloutPercentage = 25
(Mais testes, ainda seguro)
```

### Dia 6: Rollout Médio
```
rolloutPercentage = 50
(Metade dos usuários)
```

### Dia 7: Rollout Completo
```
rolloutPercentage = 100
(Todos os usuários)
```

---

## 📊 Estrutura no Firestore

```
restaurants/{restaurantId}/
  feature_flags/{flagName}/
    {
      name: "new-profit-calc",
      enabled: true,
      rolloutPercentage: 25,  // 0-100
      whitelistedUsers: [],  // Apenas esses (vazio = todos)
      blacklistedUsers: [],  // Excluir esses
      startDate: timestamp,  // Quando ativar
      endDate: timestamp,    // Quando desativar
      description: "...",
      createdAt: timestamp,
      updatedAt: timestamp
    }
```

---

## 🎨 Exemplos Práticos

### Exemplo 1: A/B Testing (Comparar UI)

```javascript
// MenuPage.jsx
const MenuPage = () => {
  const { restaurant, user } = useAuth();
  const { isEnabled: useNewUI } = useFeatureFlag('new-menu-ui', restaurant.restaurantId, user.id);

  return (
    <>
      {useNewUI ? (
        // Nova UI (com novas cores/layout)
        <NewMenuLayout />
      ) : (
        // UI antiga
        <OldMenuLayout />
      )}
    </>
  );
};
```

### Exemplo 2: Desativar Feature se Houver Erro

```javascript
// Dashboard.jsx
const Dashboard = () => {
  const [realTimeError, setRealTimeError] = useState(false);
  const { isEnabled: useRealTimeUpdates } = useFeatureFlag(...);

  useEffect(() => {
    if (useRealTimeUpdates) {
      try {
        setupRealtimeListeners(); // Issue #9
      } catch (error) {
        setRealTimeError(true);
        // Em produção, envia erro para Sentry
        captureException(error);
      }
    }
  }, [useRealTimeUpdates]);

  return (
    <>
      {realTimeError && (
        <Alert>
          Modo tempo real indisponível. Atualize manualmente.
        </Alert>
      )}
      {/* conteúdo */}
    </>
  );
};
```

### Exemplo 3: Feature para Maitre/Gerenciador

```javascript
// RecipesPage.jsx
const { isEnabled: useAdvancedCostCalc } = useFeatureFlag(
  'advanced-cost-analysis',
  restaurantId,
  user.id
);

// Mostra análise avançada só para quem tem permissão
{useAdvancedCostCalc && <AdvancedCostAnalysis recipe={recipe} />}
```

---

## 🚨 Monitoramento

### Rastreie junto com Sentry:

```javascript
import { addBreadcrumb } from '../lib/sentry';

const handleSale = async () => {
  // Log que feature foi usada
  addBreadcrumb(
    `Sale with new-profit-calc flag enabled`,
    'feature-flag',
    'info'
  );

  // Se algo der errado, sentry mostra que flag estava ativado
  try {
    await createSale(...);
  } catch (error) {
    captureException(error, {
      feature_flag: 'new-profit-calc',
      feature_enabled: true,
    });
  }
};
```

---

## 📋 Checklist: Antes de Ativar Feature Flag

- [ ] Código escrito e testado
- [ ] PR revisado
- [ ] Testes passam: `npm run test`
- [ ] Flag criada no Firestore (rolloutPercentage = 0)
- [ ] Whitelist seu user-id (teste interno)
- [ ] Monitorar Sentry por 1 dia
- [ ] Se OK, aumentar rolloutPercentage
- [ ] Se erro, desativar imediatamente

---

## 🔧 Troubleshooting

### Flag não está funcionando?

1. Verifica se flag existe no Firestore
2. Verifica se `enabled: true`
3. Verifica se rolloutPercentage > 0
4. Verifica se user.id está em whitelistedUsers (se usado)
5. Verifica console do browser (DevTools → Console)

### Quer desativar urgente?

```javascript
// Roda no console
await setFlagEnabled('seu-restaurante-id', 'new-profit-calc', false);
```

---

## 📚 Referências

- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Feature Flags Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [Sentry Integration](https://docs.sentry.io/platforms/javascript/enriching-events/breadcrumbs/)
