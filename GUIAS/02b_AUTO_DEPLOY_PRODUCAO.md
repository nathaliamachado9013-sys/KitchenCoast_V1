# 2B️⃣ Auto-Deploy em Produção

## O que é?

**Produção** = Ambiente real onde usuários reais usam o app

**Auto-deploy em produção** = Toda vez que você faz `git push origin main`, o app é automaticamente atualizado em produção (após testes passarem)

### Fluxo Completo

```
Você (VSCode):              GitHub:                    Produção:
┌─────────────┐             ┌──────────────┐           ┌──────────┐
│ git push    │─────────────│ Detecta novo │           │ Atualiza │
│ origin      │             │ commit em    │─Workflow─│ App      │
│ main        │             │ main         │ dispara   │          │
└─────────────┘             └──────────────┘           │ Firebase │
                                  │                     │ Hosting  │
                                  │                     │          │
                                  │                     │ 100%     │
                                  │                     │ VIVO     │
                                  │                     └──────────┘
                                  │
                                (5-10 min depois)

Seu app está VIVO em produção!
https://kitchencost-e1a2e.web.app
```

---

## ⚙️ Como Configurar (Primeira Vez)

### Passo 1: Gerar Credenciais Firebase

1. Abra: https://console.firebase.google.com
2. Selecione seu projeto (KitchenCoast)
3. ⚙️ Project Settings (engrenagem no topo)
4. Aba "Service Accounts"
5. Clique: "Generate New Private Key"
6. Arquivo JSON é baixado automaticamente

### Passo 2: Adicionar Secret no GitHub

1. GitHub → Seu repositório
2. Settings (engrenagem no topo)
3. Esquerda: Secrets and variables → Actions
4. Clique: "New repository secret"
5. Preencha:
   ```
   Name: FIREBASE_SERVICE_ACCOUNT_PROD
   Secret: [Cole o JSON inteiro]
   ```
6. Clique: "Add secret"

### Passo 3: Pronto!

Agora toda vez que faz push em `main`, deploy automático vai acontecer!

---

## 🚀 Usar (Todos os Dias)

### Passo 1: Faça suas mudanças

Edite arquivos normalmente no VSCode

### Passo 2: Commit e Push para main

```bash
git add .
git commit -m "feat: sua mudança aqui"
git push origin main
```

### Passo 3: Acompanhe o Deploy

GitHub → **Actions** (aba no topo)

Você verá:

```
Deploy to Production #42
🟡 In Progress

├─ test (2m)
│  ├─ ✅ Checkout code
│  ├─ ✅ Install dependencies
│  ├─ ✅ Run linter
│  ├─ ✅ Run typecheck
│  └─ 🟡 Run tests (rodando...)
│
├─ deploy-frontend (aguardando testes)
│
└─ notify (aguardando tudo)
```

### Passo 4: Verificar se Passou

Quando terminar, você verá:

```
✅ Deploy to Production #42 - Passed

Seu app está atualizado em:
https://kitchencost-e1a2e.web.app
```

---

## ⏱️ Quanto Tempo Leva?

| Fase | Tempo |
|------|-------|
| Testes | 2-3 min |
| Build | 1-2 min |
| Deploy Frontend | 2-3 min |
| Smoke Tests | 30 seg |
| **TOTAL** | **5-10 min** |

---

## 📊 Entender os Passos do Deploy

### 1. **Test Job (2-3 minutos)**

```
✅ Checkout code
✅ Setup Node.js
✅ Install dependencies
✅ Run linter (verifica estilo)
✅ Run typecheck (verifica tipos)
✅ Run tests (roda suite de testes)
✅ Build (compila para produção)
```

**Se falhar aqui:** ❌ Deploy PARA. Ninguém vai para produção com testes falhando.

**Se passar:** ✅ Continua para deploy

### 2. **Deploy Frontend (2-3 minutos)**

```
✅ Checkout code
✅ Setup Node.js
✅ Install dependencies
✅ Build frontend (React)
🟡 Deploy to Firebase Hosting (enviando arquivos)
```

**O que faz:**
- Compila React em arquivos otimizados
- Envia para Firebase Hosting
- Ativa HTTPS
- CDN distribui globalmente

### 3. **Deploy Backend (2-3 minutos, se aplicável)**

```
✅ Build backend
✅ Deploy to Cloud Run
```

**Se não há mudanças no backend:** Pula este passo

### 4. **Smoke Tests (30 segundos)**

```
✅ Verificar se frontend está respondendo
✅ Fazer requisição HTTP para app
✅ Confirmar que está vivo
```

### 5. **Notificações (Slack/Email)**

```
✅ Notifica sucesso
OU
❌ Notifica falha (com erro)
```

---

## 🔴 O que Pode Dar Errado?

### Erro 1: "Permission Denied" no Deploy

```
❌ Deploy to Firebase failed
   Error: Permission denied
```

**Causa:** Secret não foi configurado corretamente

**Solução:**
1. GitHub → Settings → Secrets
2. Delete secret: `FIREBASE_SERVICE_ACCOUNT_PROD`
3. Adicione novamente com JSON correto

### Erro 2: "Tests Failed"

```
❌ Test job failed
   Error: pnpm run test - 5 testes falharam
```

**Causa:** Seu código tem bugs

**Solução:**
1. Vê qual teste falhou
2. Arruma localmente
3. Roda `pnpm run test` para verificar
4. Faz novo commit e push

### Erro 3: "Build Failed"

```
❌ Build failed
   Error: src/pages/NewPage.jsx:45 - Cannot find module
```

**Causa:** Erro no código (import errado, sintaxe, etc)

**Solução:**
1. Abre arquivo mencionado
2. Procura o erro (linha 45)
3. Arruma
4. Faz novo commit e push

### Erro 4: "Deploy Stuck"

Workflow está "In Progress" há mais de 30 minutos

**Solução:**
1. GitHub Actions → clica no workflow
2. Clica: "Cancel workflow"
3. Faz novo push (cria trigger novo)

---

## ✅ Checklist: Deploy Bem-Sucedido

- [ ] Fiz `git push origin main`
- [ ] GitHub Actions dispara (vejo em Actions tab)
- [ ] Testes rodam (vejo em tempo real)
- [ ] Build passa
- [ ] Deploy passa
- [ ] Smoke tests passam ✅
- [ ] Abri https://kitchencost-e1a2e.web.app e testei
- [ ] Mudança está VIVA em produção

---

## 🆚 Diferença: Produção vs Staging

| | Staging | Produção |
|---|---------|----------|
| **Branch** | `develop` | `main` |
| **URL** | staging.kitchencost.web.app | kitchencost-e1a2e.web.app |
| **Usuários** | Apenas você (teste) | TODOS (real) |
| **Criticidade** | Teste seguro | CRÍTICA |
| **Deploy automático** | ✅ Sim | ✅ Sim |
| **Quando usar** | Testar features novas | Apenas código estável |

---

## 🎯 Fluxo Recomendado

```
1. Cria branch: git checkout -b feature/nova-feature
2. Edita código e testa localmente
3. Faz commit: git commit -m "feat: nova feature"
4. Faz push para develop: git push origin feature/nova-feature
5. Cria PR (Pull Request)
6. Review do código
7. Merge em develop
8. Auto-deploy em STAGING
9. Você testa em staging
10. Se OK → Merge em main
11. Auto-deploy em PRODUÇÃO ✅
12. Usuários usam a nova feature
```

---

## 💡 Dicas

### Dica 1: Monitorar Deploy em Tempo Real

```bash
# Terminal
watch -n 5 "curl -I https://kitchencost-e1a2e.web.app"
# Atualiza a cada 5 segundos
```

### Dica 2: Ver Logs Completos

GitHub Actions → seu workflow → clique em cada job para ver logs detalhados

### Dica 3: Desativar Auto-Deploy (Emergência)

Se precisar parar deploy temporariamente:

1. GitHub → Settings → Branches
2. Add branch protection rule
3. Require status checks before merging
4. Desativa regra quando passar da emergência

### Dica 4: Deploy Manual (Se Precisar)

```bash
cd artifacts/kitchencost
pnpm run build
firebase deploy --only hosting:kitchencost-e1a2e
```

---

## 🔗 Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Your Repo Actions](https://github.com/nathaliamachado9013-sys/KitchenCoast_V1/actions)
- [Firebase Console](https://console.firebase.google.com)

---

**Última atualização**: 2026-06-17  
**Versão**: 1.2.0
