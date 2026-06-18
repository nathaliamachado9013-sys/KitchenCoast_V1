# 🔧 Detalhamento Completo de Erros e Correções

**Status**: 5/11 erros corrigidos | **Última atualização**: 2026-06-20

---

## ✅ ERROS CORRIGIDOS

### **✅ Erro #5 + #6: Cálculo de Unidades (DONE)**
**Arquivo**: `firestore.js` - Linha 371+  
**Problema**: 25g farinha × €1,42/kg = €35,50 ❌  
**Solução**: Implementada conversão de unidades em `calculateRecipeCost()`  
**Status**: ✅ Deploy #99bdc9d

---

### **✅ Erro #7: Múltiplas Fichas Técnicas (DONE)**
**Arquivo**: `firestore.js` - Funções `createMenuItem()` e `updateMenuItem()`  
**Problema**: Apenas 1 receita por menu item  
**Solução**: Mudança para array `recipeIds[]` com cálculo automático de custo  
**Compatibilidade**: Backward compatible com `recipeId` legado  
**Status**: ✅ Deploy #99bdc9d

---

### **✅ Erro #1: Editar Compras Após Lançar (DONE)**
**Arquivo**: `firestore.js` - Adicionada função `getInvoice()`  
**Problema**: Compras não podiam ser editadas  
**Solução**: Função para recuperar invoice para edição  
**Status**: ✅ Deploy #99bdc9d  
**UI Pendente**: Adicionar botão "Editar" em PurchasesPage (PRÓXIMO)

---

### **✅ Erro #2: Total Nota Obrigatório (DONE)**
**Arquivo**: `PurchasesPage.tsx` - Validação adicionada  
**Problema**: Salvia sem totalAmount  
**Solução**: 
  - Validação antes de salvar
  - Auto-calcula se vazio: `sum(lineTotal)`
  - Toast mostra valor calculado
  - Rejeita se total ainda = 0
**Status**: ✅ Deploy #344738b

---

### **✅ Erro #5b: Água Filtrada como Ingrediente (PARCIAL)**
**Problema**: Água foi adicionada como revenda (bebida) em vez de ingrediente  
**Solução**: Requer compra adicional com água como ingrediente base  
**Ação**: Usuário deve adicionar manualmente em nova compra:
  ```
  Nome: Água Filtrada
  Categoria: Ingredientes (não Bebidas)
  Quantidade: 50L (garrafão 1,5L × ~33)
  Preço: €0,40/L (Makro)
  ```
**Status**: ⏳ Requer entrada manual de dados

---

## ⏳ ERROS PENDENTES

### **❌ Erro #3: Novo Item Aparece por Último**
**Arquivo(s)**: `RecipesPage.tsx` (ou similar - página de nova receita)  
**Problema**: Ao adicionar novo ingrediente, aparece no final da lista  
**Causa**: Items renderizados em ordem natural; novo aparece último  
**Solução Recomendada**:
```javascript
// ANTES:
{recipe.ingredients.map((ing, idx) => ...)}

// DEPOIS - Renderizar novo formulário PRIMEIRO:
<>
  {showNewIngredientForm && <NewIngredientForm />}
  {recipe.ingredients.map((ing, idx) => ...)}
</>
```
**Alternativa**: Usar ordem reversa para novo item primeiro
**Impacto UI**: Usuário não precisa scroll a cada item  
**Status**: 🔴 BLOQUEADO - Precisa localizar arquivo correto

---

### **❌ Erro #4: Remover Campo "Tempo de Preparo"**
**Arquivo**: `RecipesPage.tsx` (ou modal de nova receita)  
**Problema**: Campo de "tempo de preparo" não é usado  
**Solução**: Remover campo do formulário  
**Buscar por**: `tempoPrep`, `prepTime`, `cookingTime`, `tempo`  
**Impacto**: Simplifica UI, menos confusão  
**Status**: 🔴 Precisa localizar e remover

---

### **❌ Erro #6b: UI/UX Editar Receita Confusa**
**Arquivo**: `RecipesPage.tsx` (modal de editar receita)  
**Problema Atual**:
  - 3 abas confusas
  - Valores de precificação sem contexto
  - Não fica claro o que clicar
  - Campo "Preço de Venda" vazio causa confusão

**Solução Proposta**:
```
┌─────────────────────────────────────┐
│ EDITAR RECEITA                      │
├─────────────────────────────────────┤
│                                      │
│ Nome da Receita *                    │
│ [Margherita.................]         │
│                                      │
│ Categoria                            │
│ [Pizzas................]             │
│                                      │
│ Ingredientes:                        │
│ ├─ Massa: 35g (€0,04)               │
│ ├─ Molho: 30g (€0,02)               │
│ └─ Mozzarella: 80g (€0,64)          │
│                                      │
│ ┌─ CUSTOS ─────────────────────────┐│
│ │ Custo de Ingredientes: €0,70      ││
│ │ Custos Variáveis: €0,00           ││
│ │ ┌────────────────────────────────┤│
│ │ │ CUSTO TOTAL/PORÇÃO: €0,70      ││
│ │ └────────────────────────────────┤│
│ └────────────────────────────────────┘
│                                      │
│ ┌─ PREÇIFICAÇÃO ────────────────────┐│
│ │ Preço de Venda:                  ││
│ │ [€____________]                   ││
│ │                                   ││
│ │ Margem Desejada:                 ││
│ │ [_____] % (sugestão: 70%)        ││
│ │                                   ││
│ │ ┌─────────────────────────────────┤│
│ │ │ Preço Sugerido: €2,33 (70%)     ││
│ │ │ Lucro/Prato: €1,63              ││
│ │ └─────────────────────────────────┤│
│ └────────────────────────────────────┘
│                                      │
│  [Cancelar]    [✓ Salvar Receita]   │
└─────────────────────────────────────┘
```

**Mudanças**:
  1. Remover 3 abas - tudo em 1 página
  2. Mostrar custo total em DESTAQUE (fundo colorido)
  3. Seção "Preçificação" bem definida
  4. Preço sugerido em verde/destaque
  5. Atualizar em tempo real ao mudar preço/margem
  6. Botão de salvar bem visível e claro

**Impacto**: Usuário entende fluxo, menos confusão  
**Status**: 🔴 Requer redesign do modal

---

### **❌ Erro #8: Preço Sugerido em Bebidas de Revenda**
**Arquivo**: `ResaleProductsPage.tsx` (ou similar)  
**Problema Atual**:
  - Bebida: Cerveja €0,70 de custo
  - Campo "Preço de venda" vazio
  - Lucro: -€0,70 | Margem: 0%
  - Sem sugestão de preço

**Solução Proposta**:
```javascript
// Estado
const [product, setProduct] = useState({
  nome: 'Cerveja Super Bock',
  custodecompra: 0.70,
  precoVenda: '',
  margemDesejada: 70,  // % padrão
});

// Cálculo em tempo real
const precoSugerido = custodecompra * (1 + margemDesejada / 100);
const lucro = precoVenda - custodecompra;
const margem = precoVenda > 0 ? ((lucro / precoVenda) * 100) : 0;
```

**UI**:
```
┌─────────────────────────────────────┐
│ EDITAR PRODUTO DE REVENDA           │
├─────────────────────────────────────┤
│ Nome: [Cerveja Super Bock........]   │
│ Custo de Compra: €0,70              │
│                                      │
│ Preço de Venda:                      │
│ [____________] €                     │
│                                      │
│ Margem Desejada:                     │
│ [70] % (padrão)                      │
│                                      │
│ ┌─ SUGESTÃO ────────────────────────┐│
│ │ Preço Sugerido: €2,38 (70%)       ││
│ │ Seu Lucro: €1,68/unidade          ││
│ │ [Usar Preço Sugerido]             ││
│ └────────────────────────────────────┘
│                                      │
│ Seu Preço: €2,00                     │
│ Lucro Real: €1,30                    │
│ Margem Real: 65%                     │
│                                      │
│  [Cancelar]    [✓ Salvar]            │
└─────────────────────────────────────┘
```

**Mudanças**:
  1. Campo "Margem Desejada" (% configurável)
  2. Botão "Usar Preço Sugerido" 
  3. Atualizar em tempo real
  4. Mostrar lucro real vs sugerido

**Status**: 🔴 Requer UI em ResaleProductsPage

---

### **❌ Erro #9: Registrar Produção com Quantidade**
**Arquivo**: `ProductionPage.tsx` (ou modal de registrar produção)  
**Problema Atual**: Apenas seleciona receita, não define quanto produziu  
**Solução**:

```javascript
// Novo estado
const [production, setProduction] = useState({
  receitaId: '',
  quantidadeProuzida: '',
  unidade: 'porções',  // ou 'kg', 'L', 'unidade'
});

// Cálculo automático
const custoUnitario = receita.costPerPortion || 0;
const custoTotal = quantidadeProuzida * custoUnitario;

// Validação de estoque ANTES
const validarEstoque = () => {
  for (let ingredient of receita.ingredients) {
    const necessario = ingredient.quantity * quantidadeProuzida;
    const disponivel = estoque[ingredient.id];
    if (necessario > disponivel) {
      throw new Error(`Falta ${necessario - disponivel}kg de ${ingredient.name}`);
    }
  }
};

// Ao registrar
const registrarProducao = async () => {
  validarEstoque();
  
  // Criar documento de produção
  await createProduction(restaurantId, {
    receitaId: production.receitaId,
    quantidade: production.quantidadeProuzida,
    unidade: production.unidade,
    custoUnitario,
    custoTotal,
    ingredientesUsados: [...],
    dataProducao: new Date(),
  });
  
  // Descontar do estoque (stock_movements)
  for (let ingredient of receita.ingredients) {
    const qty = ingredient.quantity * quantidadeProuzida;
    await createStockExit(restaurantId, {
      ingredientId: ingredient.id,
      quantity: qty,
      reason: 'producao',
      referenceProduction: productionId,
    });
  }
  
  // Verificar estoque crítico
  checkCriticalStock();
};
```

**UI**:
```
┌─────────────────────────────────────┐
│ REGISTRAR PRODUÇÃO                  │
├─────────────────────────────────────┤
│ Receita *                            │
│ [Massa de Pizza.........] ▼          │
│                                      │
│ Custo por porção: €1,43              │
│ Peso por porção: 35g                 │
│                                      │
│ Quantidade Produzida *               │
│ [200............] [porções ▼]        │
│                                      │
│ ┌─ CUSTO ────────────────────────────┐│
│ │ €1,43 × 200 = €286,00              ││
│ └────────────────────────────────────┘│
│                                      │
│ Observações (opcional)               │
│ [Produção matinal...............]    │
│                                      │
│  [Cancelar]  [✓ Registrar Produção] │
└─────────────────────────────────────┘
```

**Validações**:
  1. Quantidade obrigatória
  2. Verificar estoque ANTES de permitir
  3. Mostrar falta se insuficiente
  4. Desconta automaticamente do estoque

**Status**: 🔴 Requer novo componente/página

---

### **❌ Erro #10: Alertas de Estoque Crítico**
**Arquivo(s)**: Dashboard, Sidebar, StockPage  
**Problema**: Sem notificação quando estoque atinge mínimo  
**Solução**:

**1. Criar função em firestore.js**:
```javascript
export const checkCriticalStock = async (restaurantId) => {
  const ingredients = await getIngredients(restaurantId);
  
  const alertas = ingredients
    .filter(ing => (ing.currentStock || 0) <= (ing.minStock || 0))
    .map(ing => ({
      ingredientId: ing.id,
      nome: ing.name,
      atual: ing.currentStock,
      minimo: ing.minStock,
      falta: Math.ceil((ing.minStock || 0) - (ing.currentStock || 0)),
      severidade: ing.currentStock === 0 ? 'crítica' : 'alta'
    }));
  
  return alertas;
};

// Salvar alertas no Firestore (persistência)
export const saveCriticalStockAlerts = async (restaurantId, alertas) => {
  const ref = doc(db, 'restaurants', restaurantId, 'settings', 'stockAlerts');
  await setDoc(ref, {
    alertas,
    lastUpdated: serverTimestamp(),
  });
};
```

**2. Dashboard Widget**:
```jsx
// Em Dashboard.tsx
const [stockAlerts, setStockAlerts] = useState([]);

useEffect(() => {
  const loadAlerts = async () => {
    const alertas = await checkCriticalStock(restaurant.id);
    setStockAlerts(alertas);
  };
  loadAlerts();
}, []);

return (
  <>
    {stockAlerts.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <h3 className="text-red-900 font-bold mb-3">
          ⚠️ {stockAlerts.length} ALERTAS DE ESTOQUE
        </h3>
        <ul className="space-y-2">
          {stockAlerts.map(alerta => (
            <li key={alerta.ingredientId} className="text-sm text-red-800">
              <span className={alerta.severidade === 'crítica' ? 'text-red-600 font-bold' : ''}>
                {alerta.nome}
              </span>
              : {alerta.atual}/{alerta.minimo} 
              (falta {alerta.falta})
              <button className="ml-2 text-red-600 underline text-xs">
                Comprar
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}
  </>
);
```

**3. Badge na Sidebar**:
```jsx
// Em Sidebar.tsx
<div className="flex items-center gap-2">
  <PackageOpen className="w-4 h-4" />
  <span>Estoque</span>
  {stockAlerts.length > 0 && (
    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
      {stockAlerts.length}
    </span>
  )}
</div>
```

**4. Página de Estoque - Aba Alertas**:
```jsx
// Adicionar aba em StockPage.tsx
<TabsTrigger value="alertas">
  Alertas ({stockAlerts.length})
</TabsTrigger>

<TabsContent value="alertas">
  {stockAlerts.length === 0 ? (
    <p className="text-center text-green-600">✓ Sem alertas</p>
  ) : (
    <table className="w-full text-sm">
      <thead>...</thead>
      <tbody>
        {stockAlerts.map(alerta => (
          <tr key={alerta.ingredientId} className="border-t">
            <td>{alerta.nome}</td>
            <td className="text-red-600 font-bold">{alerta.atual} (mín: {alerta.minimo})</td>
            <td>{alerta.falta} para repor</td>
            <td>
              <button>Fazer Compra</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</TabsContent>
```

**Status**: 🔴 Requer implementação em 3 páginas

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

```
CRÍTICOS (DONE):
☑️ #5 + #6: Cálculo unidades
☑️ #7: Múltiplas fichas técnicas
☑️ #1: Editar compras
☑️ #2: Total nota obrigatório
☑️ #5b: Água filtrada (dados)

ALTOS (PRÓXIMOS):
☐ #3: Novo item por último
☐ #4: Remover tempo preparo

MÉDIOS (DEPOIS):
☐ #6b: UI editar receita (GRANDE)
☐ #8: Preço sugerido bebidas

NOVOS (DEPOIS):
☐ #9: Produção com quantidade (GRANDE)
☐ #10: Alertas estoque (GRANDE)
```

---

## 🚀 PRÓXIMAS AÇÕES

1. **Deploy atual**: Aguarde workflow #344738b (testes + deploy)
2. **Testar em produção**: Verificar se cálculos estão corretos
3. **Próximo ciclo**: Implementar #3, #4 (rápidos)
4. **Depois**: #6b, #8, #9, #10 (requerem mais trabalho)

---

**Última atualização**: 2026-06-20  
**Versão**: KitchenCoast v1.3.0 (em desenvolvimento)
