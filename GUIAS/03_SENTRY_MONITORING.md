# 3️⃣ Monitoring com Sentry

## O que é Sentry?

**Sentry** = Ferramenta que rastreia erros em produção em TEMPO REAL

### Antes (Sem Sentry)
```
Usuário está usando app
    ↓
Algo quebra (erro)
    ↓
Usuário vê: "Error: Something went wrong"
    ↓
Usuário não faz nada (ou fecha app)
    ↓
Você NUNCA fica sabendo que quebrou! 😱
```

### Depois (Com Sentry)
```
Usuário está usando app
    ↓
Algo quebra (erro)
    ↓
Sentry ENVIA erro para seus servidores
    ↓
Você recebe alerta: "🚨 Erro em produção!"
    ↓
Você clica link → vê stack trace completo
    ↓
Você arruma e deploy hotfix 🔧
```

---

## Setup Sentry (Primeira Vez)

### Passo 1: Criar Conta

1. Abra: https://sentry.io/
2. Clique: "Create Organization"
3. Preencha:
   ```
   Email: seu_email@gmail.com
   Password: senha_forte
   Organization name: KitchenCoast
   ```
4. Clique: "Create Organization"

### Passo 2: Criar Projeto

```
Sentry mostra:
┌─ Create a Project ─────────────────┐
│                                    │
│ Qual plataforma?                   │
│ ├─ Electron                        │
│ ├─ JavaScript                      │
│ ├─ Python                          │
│ └─ React ← SELECIONE ESTA          │
│                                    │
│ Clique: "Create Project"           │
└────────────────────────────────────┘
```

### Passo 3: Copiar DSN

Sentry mostra:

```
┌─ Configuration ────────────────────────────────────┐
│                                                    │
│ Copie seu DSN:                                     │
│ https://sua_chave_muito_longa@sentry.io/1234567   │
│                                                    │
│ Guarde em local seguro (copie para .env)          │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Passo 4: Configurar .env Local

No VSCode:

**Abra arquivo**: `artifacts/kitchencost/.env`

```bash
# Abra com Ctrl + P
Ctrl + P
Digite: .env
Aperte Enter
```

**Adicione:**

```env
VITE_SENTRY_DSN=https://sua_chave@sentry.io/1234567
VITE_APP_VERSION=1.2.0
```

**Salve:**
```
Ctrl + S
```

### Passo 5: Instalar Dependências

Terminal do VSCode (Ctrl + `):

```bash
cd artifacts/kitchencost
pnpm install

# Instala: @sentry/react, @sentry/tracing
```

### Passo 6: Reiniciar Dev Server

```bash
# Se estava rodando, para:
Ctrl + C

# Roda de novo:
pnpm run dev

# Abre em: http://localhost:5173
```

✅ **Pronto! Sentry está instalado!**

---

## Como Testar Localmente

### Teste 1: Verificar se Sentry Iniciou

Console do browser (F12 → Console):

```javascript
console.log(Sentry);
// Deve mostrar um objeto grande com funções
// Se undefined = não inicializou corretamente
```

### Teste 2: Enviar erro de teste

Console do browser (F12 → Console):

```javascript
// Importa Sentry
import * as Sentry from '@sentry/react';

// Dispara erro
Sentry.captureException(new Error("Teste de erro"));

// Aperta Enter
```

**Depois:**
1. Vai para: https://sentry.io/organizations/kitchencost/issues/
2. Procura por "Teste de erro"
3. Deve aparecer lá! ✅

---

## Ver Erros em Produção

### Local 1: Painel Sentry (Melhor)

**Abra:**
```
https://sentry.io/organizations/seu-org/issues/
```

**Mostra:**
```
┌─ Issues ────────────────────────────────────────┐
│                                                 │
│ 🔴 TypeError: Cannot read property 'name'      │
│    ├─ Status: Unresolved                       │
│    ├─ Last seen: 30 seconds ago                │
│    ├─ Affected users: 3                        │
│    └─ Browser: Chrome 120, Firefox 121         │
│                                                 │
│ 🟡 Firebase: Permission denied                 │
│    ├─ Status: Unresolved                       │
│    ├─ Last seen: 2 minutes ago                 │
│    └─ Affected users: 1                        │
│                                                 │
│ ✅ Network timeout                             │
│    ├─ Status: Resolved                         │
│    └─ Fixed in commit abc123def                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Clique em um erro para ver detalhes

```
🔴 TypeError: Cannot read property 'name' of undefined

URL: https://kitchencost.com/recipes/page/1
User: user@email.com
Release: 1.2.0
Environment: production
Browser: Chrome 120
OS: Windows 11

Stack trace:
├─ firestore.js:234 in updateRecipe()
│  └─ const name = recipe.name; ← Erro aqui!
├─ RecipesPage.jsx:123 in handleSave()
│  └─ await updateRecipe(recipe);
└─ Button onClick

Breadcrumbs (O que o usuário fez):
├─ 14:32:15 - navigation: /recipes
├─ 14:32:20 - user-action: Clicked "Edit Recipe"
├─ 14:32:25 - user-action: Changed recipe name
└─ 14:32:30 - error: TypeError
```

---

## Integrar com GitHub

### Seu código automaticamente captura erros

Arquivo: `src/lib/sentry.js` (já criado!)

```javascript
// Qualquer erro é capturado automaticamente:

try {
  await updateRecipe(data);
} catch (error) {
  // ← Sentry captura automaticamente
  console.error(error);
}

// Ou explicitamente:
import { captureException } from './lib/sentry';

try {
  await deleteIngredient(id);
} catch (error) {
  captureException(error, {
    ingredientId: id,
    action: 'delete'
  });
}
```

### Rastreie ações do usuário (Breadcrumbs)

```javascript
import { addBreadcrumb } from './lib/sentry';

const handleSale = async () => {
  // Log da ação
  addBreadcrumb('User opened sales form', 'user-action');
  
  try {
    addBreadcrumb('Creating sale in database', 'db');
    await createSale(data);
    
    addBreadcrumb('Sale created successfully', 'db', 'info');
  } catch (error) {
    addBreadcrumb('Sale creation failed', 'db', 'error');
    throw error;
    // Quando erro é capturado, breadcrumbs aparecem!
  }
};
```

---

## Filtrar e Analisar Erros

### Filtro 1: Apenas erros não resolvidos

No painel Sentry:
```
Busca: is:unresolved
Resultado: Mostra apenas erros abertos
```

### Filtro 2: Apenas produção

```
Busca: environment:production
Resultado: Ignora erros de staging
```

### Filtro 3: Últimas 24 horas

```
Busca: firstSeen:>2024-06-17
Resultado: Erros das últimas 24h
```

### Filtro 4: Buscar palavra

```
Busca: "firebase"
Resultado: Todos os erros com "firebase" na mensagem
```

### Combinado

```
Busca: is:unresolved environment:production firstSeen:>2024-06-17 "firebase"
Resultado: Erros Firebase não resolvidos em produção nas últimas 24h
```

---

## Notificações (Slack, Email)

### Configurar alerta por email

1. Vai para: https://sentry.io/settings/...
2. Clica: "Alerts"
3. Clica: "Create Alert Rule"
4. Preencha:
   ```
   Condition: Error rate increases by 10%
   Action: Send email to seu_email@gmail.com
   ```

### Integrar com Slack (Bônus)

1. Vai para: Sentry → Settings → Integrations
2. Procura: "Slack"
3. Clica: "Install"
4. Seleciona seu workspace Slack
5. Escolhe channel: #alerts

**Agora você recebe notificações no Slack! 🔔**

---

## Troubleshooting

### Problema 1: "Sentry não está capturando erros"

**Verificar:**

```javascript
// Console do browser (F12)

// 1. Sentry está inicializado?
console.log(Sentry);
// Deve mostrar objeto

// 2. DSN está configurado?
console.log(import.meta.env.VITE_SENTRY_DSN);
// Deve mostrar: https://...sentry.io/...
```

**Solução:**

1. Verifica `.env` tem DSN
2. Verifica `src/main.tsx` tem `initSentry()`
3. Reinicia dev server

### Problema 2: "Erro não aparece no Sentry"

Às vezes erro é capturado mas leva tempo.

**Dica:** Aguarde 30-60 segundos e atualize página Sentry

### Problema 3: "Sample rate"

```javascript
// Se NENHUM erro está sendo capturado:
// Verificar em src/lib/sentry.js:

Sentry.init({
  tracesSampleRate: 1.0,  // Captura 100% dos traces
  // Ou:
  tracesSampleRate: 0.1,  // Captura apenas 10%
})
```

Se está 0.1, aumente para 1.0 em desenvolvimento.

---

## 📊 Exemplo Completo: Bugfix com Sentry

### Cenário

Seu app quebra em produção. Usuário vê erro.

**1. Você recebe email:**
```
🚨 New error in KitchenCoast

TypeError: Cannot read property 'cost'
3 users affected
Last seen: 5 minutes ago
```

**2. Clica no link, vê stack trace:**
```
firestore.js:245 in createSale()
  const totalCost = cost + operationalCostPerDish;
  ↑ Erro aqui! cost é undefined
```

**3. Vê breadcrumbs:**
```
- User opened SalesPage
- Clicked "New Sale"
- Selected menu item
- ERROR: TypeError
```

**4. Você já sabe o problema:**
```
Quando menu item não tem 'cost', quebra!
```

**5. Arruma o código:**
```javascript
// Antes (ERRADO)
const totalCost = cost + operationalCostPerDish;

// Depois (CORRETO)
const totalCost = (cost || 0) + operationalCostPerDish;
```

**6. Faz deploy:**
```bash
git add -A
git commit -m "fix: Handle missing cost field"
git push origin develop
```

**7. Sentry automaticamente marca como Resolved:**
```
No novo deploy (com tag v1.2.1):
✅ TypeError: Resolved in v1.2.1
```

---

## ✅ Checklist: Sentry Funcional

- [ ] Criei conta em Sentry.io
- [ ] Criei projeto React
- [ ] Copiei DSN
- [ ] Adicionei DSN em `.env`
- [ ] Rodei `pnpm install`
- [ ] Testei com `Sentry.captureException()`
- [ ] Erro aparece no painel Sentry
- [ ] Consigo filtrar erros
- [ ] Email de notificação funcionando

---

## 🔗 Links

- [Sentry Docs](https://docs.sentry.io/)
- [React Integration](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Error Tracking Best Practices](https://sentry.io/resources/)
