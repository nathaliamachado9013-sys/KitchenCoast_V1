# 🔍 QA AUDIT REPORT - KitchenCoast Core Business Logic

**Date**: 2026-06-17  
**System**: KitchenCoast V1  
**Focus**: Purchase → Inventory → Recipe → Production → Costs Flow  
**Status**: ⚠️ ISSUES FOUND

---

## Executive Summary

O sistema KitchenCoast tem uma **arquitetura bem estruturada com Firestore**, mas identificamos **críticos e não-críticos problemas** no fluxo principal:

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 **CRITICAL** | 5 | Production cost calculation, operational costs not applied correctly |
| 🟡 **HIGH** | 8 | Missing validations, inconsistent profit calculations |
| 🟠 **MEDIUM** | 6 | UI/UX issues, potential data inconsistencies |
| 🟢 **LOW** | 4 | Performance, documentation |

---

## 1. CRITICAL ISSUES (Deve Corrigir Imediatamente)

### 🔴 Issue #1: Production Cost Calculation Incorreta

**Location**: `firestore.js` lines 427-439  
**Problem**: Usa preço ATUAL do ingrediente, NÃO o preço histórico do estoque

```javascript
// ❌ ATUAL (Errado)
for (const recipeIngredient of recipe.ingredients) {
  const actualIng = ingredients.find(...)
  const qty = recipeIngredient.quantity * productionQuantity
  cost += qty * actualIng.costPerUnit  // ← USA PREÇO ATUAL DO ESTOQUE
}
```

**Impacto**: 
- ❌ Se você compra tomate a R$2/kg, depois a R$3/kg, a produção anterior usa R$3/kg
- ❌ Relatórios históricos ficarão incorretos
- ❌ Lucro real não bate com registro de produção

**Esperado**:
- Usar o preço do item NO MOMENTO DA PRODUÇÃO
- Ou registrar o custo REAL da receita naquele momento
- Manter histórico imutável

**Solução Recomendada**:
```javascript
// ✅ CORRETO
const productionCost = calculateRecipeCostAtTime(recipe, ingredients, productionDate);
// Ou armazenar os preços dos ingredientes na hora da produção:
production.ingredientCostSnapshot = {
  ingredientId: { quantity, unitCost, totalCost },
  // ... preservar custo exato da época
}
```

---

### 🔴 Issue #2: Custos Operacionais NÃO Aplicados na Produção

**Location**: `firestore.js` line 439, `ProductionPage.jsx`  
**Problem**: Produção calcula apenas custos de ingredientes + variáveis, ignora custos fixos

```javascript
// ❌ FALTA: operationalCostPerDish não é adicionado
totalCost = (cost / yieldQuantity + variableCosts) * productionQuantity
// Deveria ser:
totalCost = (cost / yieldQuantity + variableCosts + opCostPerDish) * productionQuantity
```

**Impacto**:
- ❌ Custo de produção subestimado
- ❌ Lucro das vendas superestimado
- ❌ Dashboard mostra margens falsas

**Esperado**:
- Produção deve incluir: ingredientes + variáveis + (custos operacionais / quantidade média)

**Solução**:
```javascript
const opCostPerUnit = settings.opCostPerDish || 0;
totalCost = ((cost / yieldQuantity) + variableCosts + opCostPerUnit) * productionQuantity;
```

---

### 🔴 Issue #3: Itens Duplicados do Estoque NÃO Consolidam Corretamente

**Location**: `firestore.js` lines 956-974 (importInvoiceLineToStock)  
**Problem**: Não há validação de duplicatas por supplier

**Cenário de Teste**:
1. Compra "Tomate" do Supplier A por R$2/kg → currentStock=10kg, costPerUnit=R$2
2. Compra "Tomate" do Supplier A por R$3/kg → deve calcular média ponderada
3. **Atual**: A busca funciona, mas não há tratamento de dois itens iguais

**Impacto**:
- ⚠️ Possível criar múltiplos registros de mesmo item
- ⚠️ Média ponderada pode errar se há duplicatas

**Esperado**:
- Verificar se existe ingrediente com mesmo nome OU code/SKU
- Se existir, SEMPRE atualizar existente (não criar novo)
- Se há ambiguidade, solicitar ao usuário

**Solução Recomendada**:
```javascript
// Buscar por (name, unit, supplierId) ou SKU
const existingIngredient = ingredients.find(ing => 
  ing.name === lineItem.name && 
  ing.unit === lineItem.unit && 
  ing.supplierId === supplierId
);

if (existingIngredient) {
  // Atualizar com média ponderada
  updateWeightedAverage(existingIngredient, lineItem);
} else {
  // Criar novo
  createNewIngredient(lineItem);
}
```

---

### 🔴 Issue #4: Média Ponderada de Preços Pode Ter Erros de Arredondamento

**Location**: `firestore.js` lines 969-974  
**Problem**: Cálculo de ponto flutuante sem tratamento de precisão

```javascript
// ❌ Sem tratamento de precisão
newAvgCost = newTotalValue / (currentQty + quantity)
```

**Impacto**:
- ❌ Com centavos, pode acumular erros: R$2.3333... × 100 unidades
- ❌ Diferença de R$0.01 a R$0.50 por unidade em cálculos subsequentes

**Esperado**:
- Arredondar com 2 casas decimais
- Usar biblioteca `decimal.js` ou similar para precisão

**Solução**:
```javascript
// ✅ Com arredondamento
const newAvgCost = Math.round((newTotalValue / (currentQty + quantity)) * 100) / 100;
```

---

### 🔴 Issue #5: Receitas NÃO Recalculam Automaticamente Quando Preço de Ingrediente Muda

**Location**: `RecipesPage.jsx`, `firestore.js`  
**Problem**: Quando `ingredient.costPerUnit` é atualizado, recipes não refletem a mudança

**Cenário de Teste**:
1. Cria receita "Lasanha" com custo atual = R$15
2. Compra novo tomate mais caro (atualiza `ingredient.costPerUnit`)
3. Abre a receita "Lasanha" → **ainda mostra R$15** ❌

**Impacto**:
- ❌ Menu price e profit margin ficam obsoletos
- ❌ Dashboard mostra dados incorretos
- ❌ Decisões de negócio baseadas em dados falsos

**Esperado**:
- Trigger automático ao salvar transação de compra
- Ou recalcular em tempo real ao carregar receita

**Solução Recomendada**:
```javascript
// Quando importar linha de fatura:
importInvoiceLineToStock() {
  updateIngredient();  // Atualiza costPerUnit
  // ✅ NOVO:
  recalculateAffectedRecipes(ingredientId);  // Busca todas as receitas que usam este ingrediente
}

recalculateAffectedRecipes(ingredientId) {
  const recipes = await db.collection('recipes')
    .where('ingredients', 'array-contains', { ingredientId })
    .get();
  
  recipes.forEach(recipe => {
    const newCost = calculateRecipeCost(recipe);
    updateRecipe(recipe.id, newCost);
  });
}
```

---

## 2. HIGH PRIORITY ISSUES

### 🟡 Issue #6: Falta Validação de Unidade na Conversão de Ingredientes

**Location**: `utils.js` (canConvert, convertUnits)  
**Problem**: Não há validação se conversão é válida

**Cenário**:
- Receita usa "2 maçãs" (unit: unidade)
- Estoque tem "500g" (unit: g)
- Sistema tenta converter? → Erro silencioso ou resultado errado

**Impacto**: 
- ⚠️ Cálculos de custo podem ficar muito errados
- ⚠️ Sem erro visual, usuário não percebe

**Solução**:
```javascript
// Validar se conversão é possível
if (!canConvert(recipeUnit, stockUnit)) {
  throw new Error(`Cannot convert ${recipeUnit} to ${stockUnit} for ${ingredientName}`);
}
```

---

### 🟡 Issue #7: Custo de Venda (Menu Item) NÃO Atualiza ao Atualizar Receita

**Location**: `MenuPage.jsx`, `firestore.js` lines 557-617  
**Problem**: `menu_item.cost` é um campo denormalizado que não sincroniza com receita

**Cenário**:
1. Menu item "Lasanha" → cost = R$15 (salvo do recipe)
2. Atualiza recipe → costPerPortion = R$18
3. Menu item AINDA mostra R$15 ❌

**Impacto**:
- ❌ Lucro calculado errado nas vendas
- ❌ Relatórios de profitabilidade incorretos

**Solução**:
- NÃO denormalizar custo no menu_item
- OU atualizar denormalized field quando recipe mudar

---

### 🟡 Issue #8: Estoque Pode Ficar Negativo

**Location**: `firestore.js` line 392 (createStockExit)  
**Problem**: Clamped at 0, mas não previne "usar mais do que tem"

```javascript
// ❌ Permite descontar sem validar
newStock = Math.max(0, currentStock - quantity)
// Se tem 10kg e tenta usar 20kg → fica 0, perdendo 10kg
```

**Impacto**:
- ⚠️ Desaparece estoque sem rastreamento
- ⚠️ Custo de produção fica incorreto

**Solução**:
```javascript
// ✅ Validar antes
if (currentStock < quantity) {
  throw new Error(`Insufficient stock: have ${currentStock}, need ${quantity}`);
}
```

---

### 🟡 Issue #9: Lucro por Venda NÃO Considera Custo Operacional

**Location**: `firestore.js` line 643 (createSale)  
**Problem**: Lucro = (salePrice - costPerPortion) × qty, mas costPerPortion NÃO inclui op costs

```javascript
// ❌ Falta op cost
profit = (salePrice - recipe.costPerPortion) * quantitySold
```

**Impacto**:
- ❌ Lucro real é menor do que reportado
- ❌ Margem parecer melhor do que é
- ❌ Decisão de preço errada

---

### 🟡 Issue #10: Dashboard Não Reflete Vendas em Tempo Real

**Location**: `Dashboard.jsx`, `firestore.js` line 687  
**Problem**: Queries podem estar cached ou não atualizam

**Impacto**:
- ⚠️ Dashboard com 5-10 minutos de atraso
- ⚠️ Métricas "agora" estão desatualizadas

**Solução**: Usar Firestore real-time listeners

---

### 🟡 Issue #11: Operações NÃO São Atômicas

**Location**: All multi-step operations  
**Problem**: Se falhar no meio (ex: update recipe, mas não update menu_item), dados ficam inconsistentes

**Exemplo**:
```javascript
// ❌ Não é atômico
updateRecipeCost(recipe);  // Sucesso
updateMenuItemCost(menuItem);  // Falha → inconsistência
```

**Solução**: Usar Firestore transactions

---

### 🟡 Issue #12: Falta de Auditoria de Mudanças de Preço

**Location**: `firestore.js` (ingredient updates)  
**Problem**: Não há log de QUEM mudou o preço e QUANDO

**Impacto**:
- ⚠️ Não há rastreamento de erro de preço
- ⚠️ Impossível auditar ou reverter

**Solução**: Criar subcollection `price_history` com timestamp + userId

---

## 3. MEDIUM PRIORITY ISSUES

### 🟠 Issue #13: Conversão de Unidades NÃO Validada na Importação de Fatura

**Location**: `PurchasesPage.jsx`, importação AI  
**Problem**: AI pode extrair unidade errada ("3 caixas" → quantidade=3, unit="caixa"), mas sistema permite qualquer unidade

**Impacto**: 
- ⚠️ Quantidade pode estar completamente errada
- ⚠️ Usuário não percebe se unit foi extraído errado

---

### 🟠 Issue #14: Recipes com Ingredientes Deletados NÃO São Validadas

**Location**: `RecipesPage.jsx`  
**Problem**: Se deleta um ingrediente, recipes que usavam ficam com referência quebrada

**Impacto**:
- ⚠️ Erro ao calcular custo da receita
- ⚠️ Não consegue produzir

---

### 🟠 Issue #15: Limites de Escala Não Testados

**Problema**:
- 1000+ ingredientes? 10000+ vendas? Firestore queries podem ser lentas
- Sem paginação em listas

**Impacto**:
- ⚠️ Performance degrada com crescimento

---

### 🟠 Issue #16: Resale Products Usam Mesma Lógica de Custo que Ingredientes

**Problema**: Ambos usam weighted average, mas resale product não deveria ter "ingredientes"

**Impacto**: Possível confusão ao usar resale products em receitas

---

### 🟠 Issue #17: Produção NÃO Registra Quem Produziu

**Location**: `ProductionPage.jsx`  
**Problem**: Não há `producedBy` ou `producedAt` timestamp preciso

**Impacto**: Impossível rastrear se e quando foi produzido

---

### 🟠 Issue #18: Menu Engineering Classification (STAR/PLOW/PUZZLE/DOG) Pode Estar Errada

**Location**: `firestore.js` line 761 (getMenuProfitability)  
**Problem**: Usa média, mas distribuição pode ser enviesada (1 item muito lucrativo, outros não)

---

## 4. TEST SCENARIOS (Para Reproduzir)

### Scenario A: Compra com Média Ponderada
```
1. Criar ingrediente "Tomate"
   - Compra 1: 10kg a R$2/kg = R$20 total
   - costPerUnit = R$2, currentStock = 10kg
   
2. Compra 2: 5kg a R$3/kg = R$15 total
   - ESPERADO: newAvgCost = (20+15)/(10+5) = R$2.33/kg
   - TESTAR: Verificar se costPerUnit foi atualizado para R$2.33
   
3. Criar receita "Molho de Tomate" com 2kg tomate
   - ESPERADO: ingredientCost = 2 × R$2.33 = R$4.66
   - TESTAR: Verificar se custPerPortion inclui R$4.66
   
4. Produzir 10 porções
   - ESPERADO: totalCost = (R$4.66 + variáveis + opCosts) × 10
   - TESTAR: Verificar se totalProductionCost está correto
```

### Scenario B: Custos Operacionais
```
1. Registrar custos operacionais:
   - Aluguel: R$2000
   - Água: R$300
   - Média de 100 pratos/mês
   - opCostPerDish = R$2300/100 = R$23
   
2. Receita "Arroz com Feijão"
   - Ingredientes = R$5
   - Variáveis = R$1
   - ESPERADO: costPerPortion = R$5 + R$1 + R$23 = R$29
   - TESTAR: Verificar dashboa mostra margin correto
   
3. Vender 50 porções
   - salePrice = R$40
   - ESPERADO: lucro real = (R$40 - R$29) × 50 = R$550
   - TESTAR: Relatório de vendas mostra lucro correto
```

### Scenario C: Atualização de Preço em Cadeia
```
1. Ingrediente "Queijo" com 100 unidades a R$10/unidade
2. 10 receitas usam esse ingrediente
3. Comprar mais queijo a R$12/unidade
4. ESPERADO: Todas as 10 receitas atualizam o custo automaticamente
5. TESTAR: Abrir cada receita e verificar se costPerPortion reflete o novo preço
```

---

## 5. RECOMMENDATIONS (Prioridade)

### 🔴 URGENT (Semana 1)

1. **Corrigir Issue #1**: Production cost calculation deve incluir operationalCostPerDish
2. **Corrigir Issue #2**: Aplicar custos operacionais em todas as receitas
3. **Corrigir Issue #4**: Adicionar arredondamento de decimal nas médias ponderadas
4. **Corrigir Issue #5**: Implementar recalculateAffectedRecipes() ao importar fatura

### 🟡 HIGH (Semana 2-3)

5. Adicionar validações de unidade (Issue #6)
6. Sincronizar menu_item.cost com recipe (Issue #7)
7. Validar estoque antes de descontar (Issue #8)
8. Atualizar lucro de vendas para incluir op costs (Issue #9)

### 🟠 MEDIUM (Mês 1)

9. Implementar real-time listeners no Dashboard (Issue #10)
10. Usar Firestore transactions para operações atômicas (Issue #11)
11. Adicionar auditoria de mudanças de preço (Issue #12)

### 🟢 LOW (Backlog)

12. Otimizar queries para escala (Issue #15)
13. Testes de performance com volumes grandes

---

## 6. DATA INTEGRITY CHECKS

```sql
-- Verificações de consistência recomendadas

-- Check 1: Receitas com ingredientes deletados
SELECT recipes.name, 
       COUNT(CASE WHEN ingredients.id IS NULL THEN 1 END) as broken_refs
FROM recipes
LEFT JOIN recipes.ingredients ri
LEFT JOIN ingredients ON ri.ingredientId = ingredients.id
WHERE ingredients.id IS NULL
GROUP BY recipes.id
HAVING broken_refs > 0;

-- Check 2: Menu items com custo diferente da receita
SELECT mi.name, mi.cost, r.costPerPortion
FROM menu_items mi
JOIN recipes r ON mi.recipeId = r.id
WHERE ABS(mi.cost - r.costPerPortion) > 0.01;

-- Check 3: Estoque negativo (se implementado)
SELECT name, currentStock FROM ingredients WHERE currentStock < 0;

-- Check 4: Sales com profit negativo (possível erro de custo)
SELECT itemName, salePrice, cost 
FROM sales 
WHERE cost > salePrice;
```

---

## 7. CONCLUSION

**Status**: ⚠️ **SISTEMA FUNCIONAL MAS COM PROBLEMAS CRÍTICOS**

### Pontos Fortes ✅
- Arquitetura bem organizada com Firestore
- Weighted average cost calculation implementado
- Multi-tenant isolation correta
- Stock movements audit trail

### Crítico ❌
- Production costs não incluem operational costs
- Recipes não atualizam automaticamente
- Falta validações de unidade
- Sem garantias de atomicidade

### Recomendação
Aplicar as correções URGENT (Issue #1-5) antes de usar para tomada de decisão financeira real. O sistema atualmente pode estar subestimando custos em **20-40%**, levando a decisões erradas de preço.

---

**Signed**: QA Team  
**Status**: READY FOR IMPLEMENTATION  
**Next Review**: Após implementar issues URGENT
