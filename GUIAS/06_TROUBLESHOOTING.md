# 6️⃣ Troubleshooting & FAQ

## Problemas Comuns e Soluções

---

## ❌ CI/CD (Testes)

### Problema: "pnpm: command not found"

```
$ pnpm run test
bash: pnpm: command not found
```

**Solução:**

```bash
# Instalar pnpm globalmente
npm install -g pnpm

# Depois tente novamente
pnpm run test
```

---

### Problema: "Cannot find module"

```
Error: Cannot find module 'react-dom'
```

**Solução:**

```bash
# Reinstalar dependências
cd artifacts/kitchencost
pnpm install

# Se persistir, limpe cache
pnpm install --force
```

---

### Problema: "Tests timeout"

```
Timeout - Async operation did not complete in 5000ms
```

**Solução:**

1. Aumento timeout do teste:

```javascript
it('should load large dataset', async () => {
  // ... teste
}, 30000); // 30 segundos ao invés de 5
```

2. Ou na workflow do GitHub:

```yaml
- name: Run tests
  run: pnpm run test
  timeout-minutes: 10  # Aumenta timeout
```

---

### Problema: "Git workflow não dispara"

Você fez push mas GitHub Actions não roda.

**Solução:**

1. Verificar se branch é `main` ou `develop`:

```yaml
# .github/workflows/test.yml
on:
  push:
    branches: [main, develop]  # Só estas branches
```

2. Se mudou branch, pode levar 1 minuto
3. Recarregue página: Ctrl + Shift + R

---

## ❌ Auto-Deploy Staging

### Problema: "Build failed"

```
❌ Build failed
Error: src/pages/RecipesPage.jsx:45 - Cannot find module
```

**Solução:**

1. Erro de import no código
2. Abra VSCode → arquivo erro
3. Verifique import statement:

```javascript
// ❌ ERRADO
import { getRecipes } from '../lib';

// ✅ CORRETO
import { getRecipes } from '../lib/firestore';
```

4. Salve e faça `git push` novamente

---

### Problema: "Deploy permission denied"

```
❌ Deploy to Firebase failed
Error: Permission denied
```

**Solução:**

1. GitHub Secrets estão corretos
2. Vai em: Settings → Secrets and variables → Actions
3. Verifica:
   - `FIREBASE_SERVICE_ACCOUNT_STAGING` existe?
   - Valor é válido (começa com `{`)?

4. Se não tiver, cria novo:

```bash
# Local, gera chave:
firebase init  # Gera arquivo JSON

# Copia conteúdo do JSON
# GitHub → Settings → Secrets → New → Paste
```

---

### Problema: "Staging não atualiza"

Você pushou para `develop` há 20 min mas staging continua antigo.

**Checklist:**

- [ ] Workflow aparece em GitHub Actions?
- [ ] Status é ✅ (não ❌ ou 🟡)?
- [ ] Esperou 10+ minutos?
- [ ] Fez refresh no navegador (Ctrl+Shift+R)?
- [ ] Verificou URL correta (staging.web.app)?

**Se ainda não atualizar:**

1. GitHub Actions → Deploy to Staging → clica no job
2. Procura mensagem de erro
3. Se não vê erro, aumenta `timeout-minutes`

---

## ❌ Sentry (Monitoring)

### Problema: "Sentry não captura erros"

Você fez `Sentry.captureException()` mas não aparece no painel.

**Solução:**

1. Verificar se inicializou:

```javascript
// Console do browser (F12)
console.log(Sentry);
// Deve mostrar objeto grande
// Se undefined, não inicializou
```

2. Verificar DSN:

```javascript
console.log(import.meta.env.VITE_SENTRY_DSN);
// Deve mostrar: https://...@sentry.io/...
// Se undefined, falta em .env
```

3. Verificar .env:

```env
# artifacts/kitchencost/.env
VITE_SENTRY_DSN=https://sua_chave@sentry.io/123456
```

4. Se mudou .env, reinicie dev server:

```bash
Ctrl + C  # Para
pnpm run dev  # Inicia novamente
```

---

### Problema: "DSN not found"

```
Error: Cannot read property 'env' of undefined
```

**Solução:**

1. .env existe? (não .env.example)
2. Adiciona:

```env
VITE_SENTRY_DSN=seu_valor_aqui
VITE_APP_VERSION=1.2.0
```

3. Salva (Ctrl + S)
4. Reinicia dev server

---

### Problema: "Erro aparece no console mas não no Sentry"

```
Console: "TypeError: Cannot read property"
Sentry Dashboard: Nada
```

**Solução:**

1. Sample rate pode estar baixo:

```javascript
// src/lib/sentry.js
Sentry.init({
  tracesSampleRate: 1.0,  // Captura 100%
  // Se estava 0.1, aumenta para 1.0
});
```

2. Erro pode ser capturado mas leva tempo:
   - Aguarde 60 segundos
   - Recarregue página Sentry

3. Verificar se Sentry está ativado:

```javascript
// Console do browser
Sentry.captureException(new Error("Test"));
```

---

### Problema: "Recebo muitos alertas falsos"

Sentry envia 100 notificações por dia.

**Solução:**

1. Vai em: Sentry → Alerts
2. Aumenta threshold:
   ```
   "Error rate increases by 50%" (ao invés de 10%)
   ```

3. Ou muda frequência:
   ```
   "Send digest once daily" (ao invés de real-time)
   ```

---

## ❌ Feature Flags

### Problema: "Feature flag não funciona"

Componente continua com código antigo mesmo com flag true.

**Solução:**

1. Verificar se flag existe no Firebase:

```
Firebase Console:
├─ Firestore
│  └─ Collections: restaurants
│     └─ [ID]
│        └─ feature_flags
│           └─ new-profit-calc  ← Deve existir
```

2. Se não existe, cria manualmente

3. Verificar valores:

```
Documento deve ter:
├─ name: "new-profit-calc"
├─ enabled: true              ← Deve ser TRUE
├─ rolloutPercentage: > 0     ← Não pode ser 0
└─ whitelistedUsers: []       ← Vazio (aplica pra todos)
```

4. Se tudo OK, recarrega app:

```
Navegador: F5 (ou Ctrl+Shift+R)
```

---

### Problema: "Collection feature_flags não criada"

```
Error: Collection not found
```

**Solução:**

1. Firebase Console → Firestore
2. Clica: "+ Start Collection"
3. ID: "feature_flags"
4. Clica: "Next"
5. Documento: "new-profit-calc"
6. Adiciona campos
7. Clica: "Save"

---

### Problema: "Não sei se flag está ativada para mim"

**Solução:**

Console do browser (F12):

```javascript
import { isFeatureFlagEnabled } from './src/lib/featureFlags';

const result = await isFeatureFlagEnabled(
  'seu-restaurant-id',
  'new-profit-calc',
  'seu-user-id'
);

console.log('Você tem flag?', result);
// true = sim
// false = não
```

---

### Problema: "Quero desativar flag de emergência"

**Solução (1 minuto):**

1. Firebase Console → Collections → feature_flags → seu_documento
2. Clica "Edit field" em "enabled"
3. Muda: true → false
4. Clica: "Update"

**Pronto! Todos param de usar em 30 segundos!**

---

## ❌ VSCode

### Problema: "Arquivo não abre"

```
Arquivo não aparece ou erro ao abrir
```

**Solução:**

1. Ctrl + P (Go to File)
2. Procura caminho completo:
   ```
   artifacts/kitchencost/src/lib/firestore.js
   ```

3. Se não achar, pasta pode estar fechada:
   - Explorer (Ctrl + Shift + E)
   - Clica seta > para expandir pastas

---

### Problema: "Terminal não funciona"

```
Terminal não abre ou não responde
```

**Solução:**

1. Ctrl + ` (backtick/crase)
2. Se não abre, tenta:
   - View → Terminal (menu)

3. Se continuar, reinicia VSCode

---

### Problema: "Extensão não funciona"

```
Prettier não formata, ESLint não valida
```

**Solução:**

1. Ctrl + Shift + X (Extensões)
2. Procura extensão
3. Clica "Uninstall"
4. Clica "Install" novamente
5. Reinicia VSCode

---

## ❌ Firebase

### Problema: "Não consigo ver collections"

```
Firestore Database vazio ou não carrega
```

**Solução:**

1. Firebase Console → Seu projeto
2. Firestore Database → Clica
3. Se mostra "No data", cria primeiro documento:
   - "+ Start Collection"

4. Se não carrega, limpa cache do browser:
   - F12 → Application → Clear Site Data

---

### Problema: "Não consigo editar documento"

```
Erro ao editar campo
```

**Solução:**

1. Firestore Security Rules podem estar bloqueando
2. Firebase Console → Firestore → Rules
3. Verifica:

```yaml
match /restaurants/{restaurantId}/feature_flags/{document=**} {
  allow read, write: if true;  # Permite escrever
}
```

4. Publica regras (Publish button)

---

## ❌ Git & GitHub

### Problema: "Não consigo fazer push"

```
Error: Permission denied (publickey)
```

**Solução:**

1. Configurar SSH key (primeira vez):

```bash
ssh-keygen -t rsa -b 4096
# Pressiona Enter 3 vezes

# Copia chave pública
cat ~/.ssh/id_rsa.pub
```

2. GitHub → Settings → SSH keys → Add key
3. Cola chave
4. Depois push funciona

---

### Problema: "Commit não aparece no GitHub"

```
Local tem commit mas GitHub não mostra
```

**Solução:**

1. Verificar se pushou:

```bash
git log  # Vê commits locais
git push origin main  # Envia para GitHub
git log --remotes  # Vê commits remotos
```

2. Recarrega página GitHub (Ctrl+Shift+R)

---

### Problema: "Pull não funciona"

```
Error: Failed to merge
```

**Solução:**

1. Se há conflitos:

```bash
git pull origin main
# Mostra: CONFLICT in arquivo.js

# Abre arquivo no VSCode
# Resolve manualmente (remove <<<, ===, >>>)

git add .
git commit -m "Resolve merge conflict"
git push origin main
```

---

## ❓ FAQ - Perguntas Frequentes

### P: Quanto tempo leva o deploy?

**R:** 5-15 minutos
- Tests: 2-3 min
- Build: 1-2 min
- Deploy Frontend: 2-3 min
- Deploy Backend: 2-3 min
- Smoke tests: 30 seg

---

### P: Posso usar feature flag em produção?

**R:** Sim! Comece com 0% e aumente gradualmente.

---

### P: Se eu desativar flag, perco dados?

**R:** Não. Flag é on/off, não deleta dados.

---

### P: Posso ter múltiplas flags?

**R:** Sim! Crie quantas precisar.

---

### P: Qual é a diferença entre staging e produção?

**R:**
- **Staging**: Seu ambiente de teste (inteiro, igual prod)
- **Produção**: Ambiente real (usuários verdadeiros)

---

### P: Sentry captura todas as requisições?

**R:** Não, apenas erros. Para requisições, use `addBreadcrumb()`.

---

### P: Posso testar feature flag localmente?

**R:** Sim, edita valor no Firebase e recarrega app.

---

### P: Quanto custa Sentry?

**R:** Grátis até 5,000 eventos/mês. Depois é pago.

---

### P: Preciso fazer rollback se algo der errado?

**R:** Depende:
- Feature flag: Desativa flag (10 seg)
- Deploy: Redeploy versão anterior (15 min)

---

## 📞 Contatos & Recursos

### Ajuda Rápida

- **Sentry Docs**: https://docs.sentry.io/
- **GitHub Actions**: https://docs.github.com/actions
- **Firebase Docs**: https://firebase.google.com/docs
- **React Docs**: https://react.dev/

### Seu Projeto

- **GitHub**: https://github.com/nathaliamachado9013-sys/KitchenCoast_V1
- **Firebase Console**: https://console.firebase.google.com/
- **Sentry Dashboard**: https://sentry.io/organizations/

---

## 📋 Checklist: Tudo Funcionando?

- [ ] Testes rodam localmente: `pnpm run test` ✅
- [ ] Dev server inicia: `pnpm run dev` ✅
- [ ] GitHub Actions mostra testes ✅
- [ ] Sentry captura erros ✅
- [ ] Feature flags funcionam ✅
- [ ] Deploy staging automático ✅
- [ ] VSCode edita arquivos sem erro ✅

---

Se problema não estiver aqui, tente:

1. Procure em documentação oficial (links acima)
2. Pergunte no Stack Overflow
3. Procure em GitHub Issues do projeto
4. Entre em contato com o desenvolvedor

---

**Última atualização**: 2026-06-17  
**Versão**: 1.2.0
