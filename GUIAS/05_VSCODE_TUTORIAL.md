# 5️⃣ VSCode: Onde Arrumar Código

## Abrir VSCode com o Projeto

### Primeira Vez

**Passo 1: Abra VSCode**

Digitano Windows:
```
Tecla Windows (logo)
Digite: VSCode
Aperte Enter
```

**Passo 2: Abra pasta do projeto**

VSCode:
```
File → Open Folder
Procura: C:\Users\natha\Claude\KitchenCoast_V1
Clica: Select Folder
```

**Passo 3: Vê estrutura do projeto**

Esquerda do VSCode (Explorer):
```
KitchenCoast_V1/
├─ .github/
│  └─ workflows/
│     ├─ test.yml          ← CI/CD
│     └─ deploy-staging.yml ← Auto-deploy
├─ artifacts/
│  └─ kitchencost/
│     ├─ src/
│     │  ├─ lib/
│     │  │  ├─ sentry.js          ← Sentry
│     │  │  ├─ featureFlags.js    ← Feature Flags
│     │  │  └─ firestore.js
│     │  ├─ hooks/
│     │  │  └─ useFeatureFlag.js  ← Hook Flags
│     │  ├─ pages/
│     │  │  ├─ SalesPage.jsx      (edite aqui)
│     │  │  ├─ Dashboard.jsx
│     │  │  └─ ...
│     │  ├─ main.tsx              ← Inicia Sentry
│     │  └─ App.tsx
│     ├─ .env                     ← Configurações locais
│     ├─ .env.example            ← Template
│     └─ package.json
├─ GUIAS/                         ← Você está aqui!
│  ├─ 00_INDICE.md
│  └─ ...
├─ DEPLOYMENT.md
└─ FEATURE_FLAGS_GUIDE.md
```

---

## Editar Arquivos

### Abrir Arquivo Rapidamente

**Atalho: Ctrl + P**

```
VSCode mostra: "Go to File" search box
┌─ Go to File ─────────────────────────┐
│ > firestore.test.js                  │ ← Digite aqui
│                                      │
│ Resultados:                          │
│ ├─ src/lib/firestore.test.js        │
│ ├─ src/lib/firestore.js             │
│ └─ src/lib/sentry.js                │
└──────────────────────────────────────┘

Clique ou aperte Enter → Abre arquivo
```

### Adicionar Código em Arquivo

**Exemplo: Adicionar feature flag em SalesPage.jsx**

```
1. Ctrl + P → saleS page.jsx → Enter
2. Arquivo abre
3. Procura linha que começa com: const SalesPage = () => {
4. Depois de abrir chaves {, adiciona:

   const { isEnabled: useNewProfit } = useFeatureFlag(...);

5. Ctrl + S para salvar
```

---

## Terminal Integrado

### Abrir Terminal

**Atalho: Ctrl + ` (backtick/crase)**

Terminal aparece na base do VSCode:

```
┌─ Seu código ────────────────────────┐
│                                     │
│ import { useAuth } from '...';      │
│ const SalesPage = () => { ... };    │
│                                     │
├─ Terminal ──────────────────────────┤
│ $ pnpm run test                     │ ← Digite aqui
│ $                                   │
└─────────────────────────────────────┘
```

### Rodar Testes no Terminal

```bash
# Navegar para pasta certa
cd artifacts/kitchencost

# Rodar testes
pnpm run test

# Ver resultado
# ✅ PASS se passou
# ❌ FAIL se falhou
```

### Rodar Dev Server

```bash
pnpm run dev

# Aparecer:
# ✓ built in 234ms
# 
# ➜  Local:   http://localhost:5173/
# ➜  press h + enter to show help

# Ctrl + clique em http://localhost:5173/
# Abre no navegador
```

### Parar Servidor

```bash
Ctrl + C

# Aparece:
# ^C  ← Servidor parou
```

---

## Git Integrado

### Ver Mudanças (Git)

**Atalho: Ctrl + Shift + G**

VSCode mostra aba Git:

```
┌─ Source Control ──────────────────┐
│ KitchenCoast_V1                   │
│                                   │
│ Changes (3)                       │
│ ├─ M src/lib/sentry.js            │
│ │  (M = Modified/Modificado)      │
│ ├─ A src/hooks/useFeatureFlag.js  │
│ │  (A = Added/Adicionado)         │
│ └─ M src/pages/SalesPage.jsx      │
│                                   │
│ [+ Stage All] [✔ Commit]          │
└───────────────────────────────────┘
```

### Fazer Commit

1. Escreva mensagem em "Message" input
2. Clique ✔ Commit
3. Git cria commit automaticamente

```
Commit: "feat: Add feature flag support"
```

### Fazer Push

**Atalho: Ctrl + Shift + P → git push**

Ou:

1. Source Control (Ctrl + Shift + G)
2. Clique nos 3 pontos (⋯)
3. Clique: "Push"

---

## Atalhos Úteis

| Atalho | O que faz |
|--------|----------|
| Ctrl + P | Abrir arquivo |
| Ctrl + F | Buscar texto no arquivo |
| Ctrl + H | Substituir texto |
| Ctrl + / | Comentar/descomentam linha |
| Ctrl + ` | Abrir terminal |
| Ctrl + Shift + G | Git |
| Ctrl + Shift + X | Extensões |
| F12 | DevTools do navegador |
| Ctrl + S | Salvar |
| Ctrl + Z | Desfazer |
| Ctrl + Shift + Z | Refazer |

---

## Extensões Recomendadas

### Instalar Extensão

1. Ctrl + Shift + X (Extensões)
2. Digite nome
3. Clica "Install"

### Essenciais

| Extensão | Por quê |
|----------|---------|
| **Prettier** | Formata código (deixa bonito) |
| **ESLint** | Encontra erros no código |
| **GitHub Actions** | Vê CI/CD no VSCode |
| **Thunder Client** | Testar APIs |
| **Sentry** | Integração Sentry |
| **Firebase** | Integração Firebase |

### Como usar Prettier

```javascript
// Código desorganizado:
const x=1;const y=2;const result = x+y;

// Salve (Ctrl + S) com Prettier ativado:
const x = 1;
const y = 2;
const result = x + y;

// ✨ Ficou lindo!
```

---

## Estrutura de Código (Onde Editar)

### Para CI/CD (Testes)

```
Arquivo: artifacts/kitchencost/src/lib/firestore.test.js

Edite: Adicione mais testes
```

### Para Auto-Deploy

```
Arquivo: .github/workflows/deploy-staging.yml

Edite: Configure branc, triggers, passos
```

### Para Sentry

```
Arquivo: artifacts/kitchencost/src/lib/sentry.js

Edite: Configurar regras de captura, samplers
```

```
Arquivo: artifacts/kitchencost/src/main.tsx

Edite: Inicializar Sentry
```

### Para Feature Flags

```
Arquivo: artifacts/kitchencost/src/lib/featureFlags.js

Edite: Lógica das flags
```

```
Arquivo: artifacts/kitchencost/src/hooks/useFeatureFlag.js

Edite: Hook React para flags
```

```
Arquivo: SEU COMPONENTE (ex: SalesPage.jsx)

Edite: Usar useFeatureFlag()
```

---

## Debugar Código

### Opção 1: Console.log

```javascript
// No código:
const handleSale = async () => {
  console.log('Starting sale...', { itemId, quantity });
  
  try {
    const result = await createSale(...);
    console.log('Sale result:', result);
  } catch (error) {
    console.error('Sale error:', error);
  }
};
```

**No browser (F12 → Console):**
```
Starting sale... { itemId: 'rec-1', quantity: 2 }
Sale result: { id: 'sale-123', profit: 50 }

// ou

Sale error: TypeError: Cannot read...
```

### Opção 2: DevTools do Browser (F12)

```
F12 → Console → Digite no terminal:
```

```javascript
// Ver variável
Sentry

// Chamar função
isFeatureFlagEnabled('rest-id', 'flag-name', 'user-id')

// Ver state
localStorage
```

### Opção 3: Breakpoint no VSCode

1. Clique na linha (esquerda) para marcar breakpoint
2. Runtime para ali, permite inspecionar

(Mais avançado, não recomendo para iniciante)

---

## Resolver Erros Comuns

### Erro 1: "Module not found"

```
Error: Cannot find module 'firebase/firestore'
```

**Solução:**
```bash
# Terminal (Ctrl + `)
cd artifacts/kitchencost
pnpm install
```

### Erro 2: "Unexpected token"

```
SyntaxError: Unexpected token }
```

**Solução:**
1. Linha mostrada tem erro de sintaxe
2. Procura por chaves/parênteses não fechados
3. Use Prettier: Ctrl + Shift + P → Format

### Erro 3: "Cannot read property X"

```
TypeError: Cannot read property 'name' of undefined
```

**Solução:**
1. Procura linha do erro
2. Adiciona verificação:

```javascript
// Antes (ERRO)
const name = user.name;

// Depois (CORRETO)
const name = user?.name || 'Unknown';
```

---

## Workflow Típico (Passo a Passo)

### Você quer adicionar feature flag

**Passo 1: Abra arquivo**
```
Ctrl + P → SalesPage.jsx → Enter
```

**Passo 2: Adicione import no topo**
```javascript
import { useFeatureFlag } from '../hooks/useFeatureFlag';
```
Ctrl + S (salva)

**Passo 3: Adicione hook no componente**
```javascript
const { isEnabled: useNewCalc } = useFeatureFlag(...);
```
Ctrl + S

**Passo 4: Use no código**
```javascript
if (useNewCalc) {
  // novo código
} else {
  // código antigo
}
```
Ctrl + S

**Passo 5: Teste**
```
Terminal: pnpm run dev
Browser: http://localhost:5173
Testa manualmente
```

**Passo 6: Commit**
```
Ctrl + Shift + G
Escreve: "feat: Add new profit calculation flag"
Clica: Commit
```

**Passo 7: Push**
```
Ctrl + Shift + G → ⋯ → Push
Ou: git push no terminal
```

---

## Tema e Personalização

### Mudar Tema (Opcional)

```
Ctrl + K Ctrl + T (Show Color Theme)

Escolha:
├─ Dark Modern (meu favorito)
├─ One Dark Pro
└─ Dracula
```

### Font Size

```
File → Preferences → Settings
Procura: Font Size
Mude para: 14 ou 16
```

---

## ✅ Checklist: VSCode Pronto

- [ ] Abri VSCode
- [ ] Abri pasta KitchenCoast_V1
- [ ] Vejo estrutura de arquivos
- [ ] Terminal funciona (Ctrl + `)
- [ ] Rodei `pnpm run dev`
- [ ] Acessei http://localhost:5173
- [ ] Consegui editar arquivo e salvar (Ctrl + S)
- [ ] Git funciona (Ctrl + Shift + G)

---

## 🔗 Links

- [VSCode Docs](https://code.visualstudio.com/docs)
- [VSCode Shortcuts](https://code.visualstudio.com/docs/getstarted/keybindings)
- [Extensions Marketplace](https://marketplace.visualstudio.com/)
