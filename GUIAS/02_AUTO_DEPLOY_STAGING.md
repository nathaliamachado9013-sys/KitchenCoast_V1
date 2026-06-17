# 2️⃣ Auto-Deploy Staging

## O que é?

**Staging** = Ambiente de testes que é IGUAL a produção

**Auto-deploy** = Toda vez que você faz `git push origin develop`, staging é atualizado AUTOMATICAMENTE

### Fluxo Completo

```
Você (VSCode):              GitHub:                    Staging:
┌─────────────┐             ┌──────────────┐           ┌──────────┐
│ git push    │─────────────│ Detecta novo │           │ Atualiza │
│ origin      │             │ commit em    │─ Workflow ├──────────│
│ develop     │             │ develop      │ dispara   │ Backend  │
└─────────────┘             └──────────────┘           │          │
                                  │                     │ Firebase │
                                  │                     │          │
                                  │                     │ Atualiza │
                                  │                     │ Frontend │
                                  │                     └──────────┘
                                  │
                                (5-15 min depois)

                            Staging está VIVO!
                            Acessa: staging.kitchencost.com
```

---

## Como Ver o Deploy Acontecendo?

### Local 1: GitHub Actions (Melhor)

**Passo 1: Abra GitHub Actions**
```
https://github.com/nathaliamachado9013-sys/KitchenCoast_V1/actions
```

**Passo 2: Procura "Deploy to Staging"**
```
┌─ Workflows ────────────────────────────────┐
│                                             │
│ 🟡 Deploy to Staging #124    (EM PROGRESSO)│
│    └─ Branch: develop                      │
│       └─ Triggered: 2 min atrás             │
│                                             │
│ ✅ Tests #124                   (PASSED)   │
│ ✅ Deploy to Staging #123       (PASSED)   │
│                                             │
└─────────────────────────────────────────────┘
```

**Passo 3: Clique em "Deploy to Staging #124"**

Abre página mostrando:

```
Deploy to Staging

Status: 🟡 In Progress

Jobs:
├─ ✅ test (2m)
│  ├─ ✅ Checkout code
│  ├─ ✅ Setup Node.js
│  ├─ ✅ Install dependencies
│  ├─ ✅ Run tests
│  └─ ✅ Build
│
├─ 🟡 deploy-frontend (5m - EM PROGRESSO)
│  ├─ ✅ Checkout code
│  ├─ ✅ Setup Node.js
│  ├─ ✅ Build frontend
│  └─ 🟡 Deploy to Firebase Staging
│     └─ Status: Uploading files... 60%
│
└─ ⏳ deploy-backend (aguardando)
   └─ Será executado quando frontend terminar
```

---

## Entender os Passos

### 1. **Test (2 minutos)**
```
Roda testes automaticamente
├─ Se FALHAR ❌: Deploy PARA e não vai pra staging
└─ Se PASSAR ✅: Continua pro próximo passo
```

**O que fazer se falhar?**
1. Vai em "Run tests" → vê erro
2. Arruma código localmente
3. Faz `git push origin develop` novamente

### 2. **Build (1-2 minutos)**
```
Compila código React para produção
├─ Otimiza tudo
├─ Minifica arquivos
└─ Gera versão pronta pra usuário
```

### 3. **Deploy Frontend (3-5 minutos)**
```
Envia código compilado pro Firebase Hosting
├─ Copia arquivos para servidor
├─ Ativa HTTPS
└─ CDN atualiza caches globais
```

### 4. **Deploy Backend (2-3 minutos)**
```
Se houver mudanças na API:
├─ Compila backend
├─ Cria Docker image
├─ Envia para Cloud Run
└─ Inicia novo container
```

### 5. **Smoke Tests (30 segundos)**
```
Testa se tudo está vivo:
├─ Faz GET em https://staging-kitchencost.com
├─ Faz GET em API health check
└─ Se 200 OK: Deploy SUCESSO ✅
```

---

## Como Testar em Staging

### Passo 1: Aguarde deploy terminar

GitHub Actions mostra:
```
✅ deploy-frontend: Deployment successful
✅ deploy-backend: Deployment successful
✅ smoke-tests: All tests passed
```

### Passo 2: Acesse staging

Abra no navegador:
```
https://staging-kitchencost.web.app
```

### Passo 3: Teste a nova feature

1. Login com sua conta
2. Testa tudo (criar venda, produção, etc)
3. Verifica se funciona

### Passo 4: Se OK → Merge para main

```bash
# Na sua máquina, quando tiver testado:

# 1. Muda para main
git checkout main

# 2. Faz merge de develop
git merge develop

# 3. Push para GitHub
git push origin main

# ✅ Agora roda Deploy para PRODUÇÃO automaticamente
```

---

## Onde Ver Logs do Deploy

### Se Deploy FALHAR ❌

**Passo 1: GitHub Actions, clique no workflow vermelho**

```
❌ Deploy to Staging #123 (FAILED)
```

**Passo 2: Procura o job que falhou**

```
├─ ✅ test
├─ ✅ deploy-frontend
└─ ❌ deploy-backend ← Clique aqui
   │
   └─ ❌ Deploy to Cloud Run
      │
      └─ Error log:
         Error: Docker build failed
         
         ERROR: Step #1 - "builder": error pulling
         image 'gcr.io/cloud-builders/docker':
         ...
```

**Passo 3: Lê o erro**

Comum:
- `Permission denied`: Credenciais erradas
- `Build failed`: Erro no código
- `Image not found`: Arquivo Dockerfile missing

### Se Deploy SUCESSO ✅

```
✅ Deploy to Staging #125 (SUCCESS)

smoke-tests output:
✅ Frontend Health: 200
✅ API Health: 200
✅ All smoke tests passed!

Slack notification: "✅ Deploy successful"
```

---

## Exemplo Real: Seu Fluxo Típico

### Dia 1: Você quer adicionar nova feature

```bash
# 1. Cria branch
git checkout -b feature/nova-feature

# 2. Faz mudanças no código
# (edita arquivos no VSCode)

# 3. Commita
git add -A
git commit -m "feat: add nova feature"

# 4. Push para develop
git push origin feature/nova-feature

# 5. GitHub: Cria Pull Request
# (você clica "Create PR" no GitHub)
```

### Dia 1 - Tarde: Tests rodam

```
GitHub Actions:
├─ ✅ Tests passed
├─ ✅ Build successful
└─ Comentário no PR:
   "All checks passed! Ready to deploy."
```

### Dia 2: Você merge PR

```bash
# Na página do PR no GitHub:
# Clica: "Squash and merge"

# OU no terminal:
git checkout develop
git merge feature/nova-feature
git push origin develop
```

### Dia 2 - Tarde: Auto-deploy roda

```
GitHub Actions dispara:
├─ 🟡 test (em andamento)
├─ 🟡 deploy-frontend (aguardando)
└─ 🟡 deploy-backend (aguardando)

5 minutos depois:
✅ Staging atualizado com nova feature
✅ Você testa em staging
✅ Tudo funciona bem
```

### Dia 3: Produção

```bash
# Você merge develop em main
git checkout main
git merge develop
git push origin main

# GitHub Actions dispara:
├─ ✅ Deploy to Production
└─ ✅ Aplicação ao vivo!
```

---

## O Que Pode Dar Errado?

### Erro 1: "Permission Denied"

```
❌ Deploy to Firebase failed
   Error: Permission denied when accessing Firebase
```

**Causa:** Credenciais Firebase erradas em GitHub Secrets

**Solução:**
1. Owner do repositório: vai em Settings → Secrets
2. Verifica: `FIREBASE_SERVICE_ACCOUNT_STAGING`
3. Renova a chave em Firebase Console

### Erro 2: "Build Failed"

```
❌ Build failed
   Error: src/pages/SalesPage.jsx:45 - Cannot find module
```

**Causa:** Erro no código

**Solução:**
1. Rodou `pnpm run build` localmente?
2. Vê o erro, arruma
3. Faz `git push origin feature/...` novamente

### Erro 3: "Deploy Stuck"

Workflow está "Em andamento" há mais de 30 minutos.

**Solução:**
1. GitHub Actions → clica no workflow
2. Clica: "Cancel workflow"
3. Faz push novamente (cria trigger novo)

### Erro 4: "Staging não está atualizado"

Você fez push mas staging continua com versão antiga.

**Checklist:**
- [ ] Seu branch é `develop` ou `feature/`?
- [ ] GitHub Actions rodou (vê em Actions tab)?
- [ ] Workflow terminou com ✅ ?
- [ ] Aguardou 5-10 minutos?
- [ ] Fez refresh no navegador (F5 ou Ctrl+Shift+R)?

---

## 📋 Checklist: Deploy Bem-Sucedido

- [ ] Fiz `git push origin develop`
- [ ] GitHub Actions dispara (vejo na aba Actions)
- [ ] Todos os jobs têm ✅
- [ ] Slack recebeu notificação ✅
- [ ] Staging está vivo: https://staging-kitchencost.web.app
- [ ] Testei e funcionou
- [ ] Fiz merge para main se estava tudo OK

---

## 🔗 Links Úteis

- [GitHub Actions Deploy](https://docs.github.com/en/actions/deployment)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Cloud Run](https://cloud.google.com/run/docs)
- [Docker Basics](https://docs.docker.com/get-started/)
