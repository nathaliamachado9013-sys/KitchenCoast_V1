# 🧹 Limpeza de Dados Órfãos

## O Problema

Você tem movimentações de estoque que ainda existem no Firestore mas não têm:
- ❌ Um ingrediente correspondente (foi deletado)
- ❌ Uma nota fiscal correspondente (foi deletada)

Esses registros "órfãos" causam inconsistências.

## A Solução

Execute o script de limpeza para remover automaticamente todos os dados órfãos.

---

## 🚀 Como Executar

### Passo 1: Encontre seu Restaurant ID

1. Abra: https://kitchencost-e1a2e.web.app
2. Faça login
3. Abra DevTools (F12 → Console)
4. Cole isto:
   ```javascript
   JSON.parse(localStorage.getItem('auth')).restaurantId
   ```
5. Copie o ID (algo como: `rest_abc123xyz`)

### Passo 2: Execute o Script

```bash
cd C:\Users\natha\Claude\KitchenCoast_V1
node cleanup-orphaned-data.js rest_abc123xyz
```

**Substitua `rest_abc123xyz` pelo seu ID real!**

### Passo 3: Confirme os Resultados

Você verá:
```
🧹 Iniciando limpeza de dados órfãos para restaurante: rest_abc123xyz

📊 Analisando movimentações de estoque...
📦 Carregando ingredientes...
📄 Carregando notas fiscais...

🔍 Procurando movimentações órfãs...
  ❌ Movimento mov_123: Ingrediente ing_456 não existe
  ❌ Movimento mov_789: Nota fiscal inv_999 não existe

📋 Resumo:
  • Total de movimentações: 127
  • Movimentações órfãs encontradas: 3

🗑️  Deletando 3 movimentações órfãs...
  ✅ Batch 1 enviado (3 itens)

✅ Limpeza concluída! 3 movimentações órfãs deletadas.
```

---

## ❓ Perguntas Frequentes

### P: E se eu tiver muitos dados órfãos?

R: O script processa em "batches" de 100 movimentações por vez. Não há limite.

### P: Posso reverter se deletar dados importantes?

R: Os dados deletados pelo script são **realmente órfãos** (não têm ingrediente/invoice). Se você arrepender, você teria que re-criar manualmente. Mas recomendo executar com confiança — são dados corrompidos de qualquer forma.

### P: O que muda no app após executar?

R: Seu estoque fica **mais consistente**:
- ✅ Nenhuma movimentação "flutuante"
- ✅ Stock Page mostra apenas dados válidos
- ✅ Relatórios mais precisos

### P: Preciso fazer backup?

R: Não é necessário para esse script (ele só deleta órfãos). Mas em produção, sempre bom manter backup recente do Firestore.

---

## 🔍 O Que o Script Faz

1. **Carrega todos os dados** do Firestore:
   - Todas as movimentações
   - Todos os ingredientes
   - Todas as notas fiscais

2. **Identifica órfãos**: Para cada movimentação, verifica:
   - Ingrediente ainda existe?
   - Se tem invoiceId, nota fiscal ainda existe?

3. **Deleta átomicamente**: Remove todos os órfãos em batches

4. **Reporta resultado**: Mostra quantos foram deletados

---

## ⚠️ Importante

- **Não execute enquanto estiver usando o app** (pode causar confusão de dados)
- **Sempre execute antes de fazer deploy importante**
- **Salve o output** para referência

---

## Próxima Vez

Agora que você tem o novo código:
- `deleteInvoice()` previne NOVOS órfãos
- `deleteStockMovement()` previne movimentações órfãs

Mas você pode sempre executar esse script periodicamente como "limpeza preventiva".

---

**Pronto? Execute: `node cleanup-orphaned-data.js your-restaurant-id`**
