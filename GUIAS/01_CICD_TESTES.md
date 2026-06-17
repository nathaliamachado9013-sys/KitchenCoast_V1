# 1️⃣ CI/CD - Testes Automáticos

## O que é CI/CD?

**CI** = Continuous Integration (Integração Contínua)
**CD** = Continuous Deployment (Deploy Contínuo)

**Em português simples:**
> Toda vez que você faz `git push`, testes rodam AUTOMATICAMENTE no GitHub, sem você fazer nada.

### Antes (Sem CI/CD)
```
1. Você: git push
2. Você (manual): npm run test (espera 2 minutos)
3. Você: Verifica se passou
4. Se falhou: arruma e faz push novamente
⏰ Tempo perdido: ~5 min por push
```

### Depois (Com CI/CD)
```
1. Você: git push
2. GitHub (automático): Roda testes em paralelo
3. GitHub: Mostra resultado ✅ ou ❌
⏰ Você sabe em 30 segundos!
```

---

## Onde Ver os Testes Rodando?

### Opção 1: GitHub Website (Melhor)

**Passo 1: Abra GitHub**
```
https://github.com/nathaliamachado9013-sys/KitchenCoast_V1
```

**Passo 2: Clique na aba "Actions"**
```
┌─ Code │ Issues │ Pull Requests │ Actions ←────────────┐
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Passo 3: Você vê todas as workflows**
```
┌─ Workflows ──────────────────────────────────┐
│                                              │
│ ✅ Tests #123                      2 min ago │
│    └─ All checks passed                      │
│                                              │
│ ✅ Deploy to Staging #122          10 min ago│
│    └─ Frontend deployed                      │
│                                              │
│ ❌ Tests #121                       25 min ago│
│    └─ Test failed on firestore.test.js      │
│                                              │
└──────────────────────────────────────────────┘
```

**Passo 4: Clique em uma para ver detalhes**
```
Clique em "✅ Tests #123"
     ↓
Abre página com detalhes:
  ├─ Status: ✅ PASSED
  ├─ Tempo total: 2m 34s
  ├─ Jobs:
  │  ├─ ✅ test (2m 34s)
  │  │   ├─ ✅ Checkout code (5s)
  │  │   ├─ ✅ Setup Node.js (10s)
  │  │   ├─ ✅ Install dependencies (45s)
  │  │   ├─ ✅ Run linter (30s)
  │  │   ├─ ✅ Run typecheck (30s)
  │  │   ├─ ✅ Run tests (45s)
  │  │   └─ ✅ Upload coverage (15s)
  │  └─ Commit: "feat: Add feature X"
  │     Author: nathaliamachado9013-sys
```

### Opção 2: No VSCode (Mais rápido)

**Extensão GitHub Actions no VSCode:**

1. Abra VSCode
2. Extensões: Ctrl + Shift + X
3. Procure: "GitHub Actions"
4. Instale: "GitHub Actions" (Microsoft)

Depois, no VSCode:
```
Atalho: Ctrl + Shift + G (ou clique GitHub)
  ↓
Clique: "GitHub Actions"
  ↓
Vê workflows em tempo real
```

---

## Como Adicionar Novos Testes?

### Arquivo de testes: `src/lib/firestore.test.js`

**Passo 1: Abra o arquivo**

No VSCode:
```
Ctrl + P (Quick Open)
  ↓
Digite: firestore.test.js
  ↓
Aperte Enter
```

**Passo 2: Adicione novo teste**

```javascript
describe('Issue #12: Novo Feature', () => {
  it('should fazer algo específico', () => {
    // Arrange (Preparar)
    const entrada = { valor: 10 };
    
    // Act (Executar)
    const resultado = meuFuncao(entrada);
    
    // Assert (Verificar)
    expect(resultado).toBe(20);
  });

  it('should falhar com entrada inválida', () => {
    expect(() => {
      meuFuncao(null);
    }).toThrow('Invalid input');
  });
});
```

**Passo 3: Salve**
```
Ctrl + S
```

**Passo 4: Rode localmente**
```
Terminal: Ctrl + `
  ↓
pnpm run test
  ↓
Vê resultado instantaneamente
```

---

## Onde Aparecem os Erros?

### Cenário 1: Teste Falha Localmente

**Terminal do VSCode:**
```
$ pnpm run test

❌ FAIL src/lib/firestore.test.js

  ✗ Issue #3: Decimal Rounding (45ms)
  
    Expect value to equal:
      10.83
    
    Received:
      10.835555
    
    at firestore.test.js:123:15
    at new Promise (<anonymous>)
    at Object.<anonymous> (node_modules/...)

Tests: 1 failed, 14 passed
```

**Como ler o erro:**

```
❌ FAIL                              ← Teste FALHOU
src/lib/firestore.test.js            ← Arquivo do teste
  ✗ Issue #3: Decimal Rounding       ← Nome do teste que falhou
    
    Expected: 10.83                  ← Valor esperado
    Received: 10.835555              ← Valor recebido
    at firestore.test.js:123:15       ← Linha 123, coluna 15
```

**Solução: Clique na linha 123:**
1. No VSCode, vai para: Ctrl + G
2. Digite: 123
3. Aperte Enter
4. Vê o código que falhou

### Cenário 2: Teste Falha no GitHub

**No GitHub Actions:**
```
1. Abra: https://github.com/.../actions
2. Clique na workflow vermelha ❌
3. Expanda a seção "Run tests"
4. Vê o mesmo erro acima
```

**Exemplo no GitHub:**
```
┌─ Deploy to Staging ────────────────────┐
│ ✅ test - 2m 34s                       │
│ ├─ ✅ Checkout code                   │
│ ├─ ✅ Setup Node.js                   │
│ └─ ❌ Run tests - 1m 20s               │ ← CLIQUE AQUI
│                                        │
│ Error output:                          │
│ ❌ FAIL src/lib/firestore.test.js      │
│ ✗ Issue #5: Unit Validation           │
│   Expected: true                       │
│   Received: false                      │
│   at firestore.test.js:234:8           │
└────────────────────────────────────────┘
```

---

## Como Arrumar Testes Quebrados?

### Exemplo: Teste falhando

```javascript
// Antes (ERRADO)
it('should round to 2 decimals', () => {
  const result = calculateCost(10.555);
  expect(result).toBe(10.55);  // ← Falha!
});
```

**Passo 1: Rodou teste, viu erro:**
```
Expected: 10.55
Received: 10.5555
```

**Passo 2: Verifica lógica em `firestore.js`:**
```javascript
// src/lib/firestore.js, linha 234
const newCost = Math.round((value) * 100) / 100;
// Problema: Está arredondando errado!
```

**Passo 3: Arruma:**
```javascript
// ✅ CORRETO
const newCost = Math.round((value * 100)) / 100;
```

**Passo 4: Roda teste novamente:**
```bash
pnpm run test
✅ PASS
```

**Passo 5: Faz commit:**
```bash
git add -A
git commit -m "fix: Decimal rounding issue"
git push origin develop
```

---

## Troubleshooting

### Erro 1: "pnpm: command not found"

```bash
# Solução:
npm install -g pnpm

# Depois tenta novamente:
pnpm run test
```

### Erro 2: "Cannot find module"

```bash
# Solução:
pnpm install

# Depois:
pnpm run test
```

### Erro 3: "Tests timeout"

Teste demora muito (>30 segundos):

```javascript
// Antes
it('should load all recipes', async () => {
  const recipes = await getRecipes('restaurant-id');
  expect(recipes.length).toBeGreaterThan(0);
}); // ← Pode timeout

// Depois (com timeout customizado)
it('should load all recipes', async () => {
  const recipes = await getRecipes('restaurant-id');
  expect(recipes.length).toBeGreaterThan(0);
}, 10000); // 10 segundos de timeout
```

### Erro 4: "Git workflow não dispara"

Se você fez `git push` mas workflow não rodou:

1. Verifica se branch é `main` ou `develop`
   - CI/CD só roda nestas branches

2. Verifica arquivo `.github/workflows/test.yml`
   - Deve ter:
   ```yaml
   on:
     push:
       branches: [main, develop]
   ```

3. Se mudou algo no workflow, pode levar 1 minuto

---

## ✅ Checklist

- [ ] Consigo acessar GitHub Actions
- [ ] Vejo workflow "Tests" rodando
- [ ] Consegui rodar `pnpm run test` localmente
- [ ] Entendo formato do erro
- [ ] Sei onde arrumar código quebrado

---

## Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vitest Docs](https://vitest.dev/) (framework de testes)
- [Testing Library](https://testing-library.com/)
