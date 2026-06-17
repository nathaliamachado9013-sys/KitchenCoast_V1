# 📚 Guias KitchenCoast - Índice

Bem-vindo ao centro de documentação do KitchenCoast! Aqui você encontra tudo que precisa saber sobre as 4 ações implementadas.

---

## 📖 Guias Disponíveis

### 1️⃣ [CI/CD - Testes Automáticos](01_CICD_TESTES.md)
- O que é CI/CD?
- Onde ver testes rodando no GitHub
- Como adicionar novos testes
- Onde aparecem os erros
- Troubleshooting

**Tempo de leitura**: 5 min | **Dificuldade**: ⭐ Fácil

---

### 2️⃣ [Auto-Deploy Staging](02_AUTO_DEPLOY_STAGING.md)
- Como funciona o deploy automático
- Entender o fluxo (git push → staging atualizado)
- Como testar em staging
- Onde ver logs do deploy
- O que fazer se falhar

**Tempo de leitura**: 7 min | **Dificuldade**: ⭐⭐ Médio

---

### 2B️⃣ [Auto-Deploy em Produção](02b_AUTO_DEPLOY_PRODUCAO.md)
- Setup inicial (gerar credenciais Firebase)
- Configurar secrets no GitHub
- Como funciona o deploy automático em produção
- Entender cada fase (testes → build → deploy)
- Como acompanhar em tempo real
- Troubleshooting e erros comuns
- Diferença entre staging e produção

**Tempo de leitura**: 12 min | **Dificuldade**: ⭐⭐⭐ Médio-Alto

---

### 3️⃣ [Monitoring com Sentry](03_SENTRY_MONITORING.md)
- Setup Sentry (primeira vez)
- Como criar conta e pegar DSN
- Configurar no .env local
- Ver erros em produção
- Como testar localmente
- Filtrar e analisar erros
- Integração com Slack (bônus)

**Tempo de leitura**: 10 min | **Dificuldade**: ⭐⭐⭐ Médio-Alto

---

### 4️⃣ [Feature Flags](04_FEATURE_FLAGS.md)
- Criar nova feature flag
- Usar em componentes React
- Rollout gradual (0% → 100%)
- Desativar se houver erro
- Exemplos práticos (A/B testing, etc)
- Monitorar com Sentry

**Tempo de leitura**: 12 min | **Dificuldade**: ⭐⭐⭐ Médio-Alto

---

### 5️⃣ [VSCode: Onde Arrumar Código](05_VSCODE_TUTORIAL.md)
- Onde cada arquivo fica
- Como editar no VSCode
- Atalhos úteis
- Terminal integrado
- Git integrado no VSCode
- Extensões recomendadas

**Tempo de leitura**: 8 min | **Dificuldade**: ⭐ Fácil

---

### 6️⃣ [Troubleshooting & FAQ](06_TROUBLESHOOTING.md)
- Problemas comuns e soluções
- Erros ao rodar testes
- Deploy falhando
- Sentry não funciona
- Feature flags não aparecem
- Dúvidas frequentes

**Tempo de leitura**: 10 min | **Dificuldade**: ⭐⭐ Médio

---

## 🚀 Quick Start (5 minutos)

### Para iniciante:

1. Leia: [01_CICD_TESTES.md](01_CICD_TESTES.md)
2. Leia: [05_VSCODE_TUTORIAL.md](05_VSCODE_TUTORIAL.md)
3. Teste: `pnpm run test` no terminal

### Para usuário intermediário:

1. Leia: [02_AUTO_DEPLOY_STAGING.md](02_AUTO_DEPLOY_STAGING.md)
2. Leia: [03_SENTRY_MONITORING.md](03_SENTRY_MONITORING.md)
3. Setup: Configure Sentry DSN no .env

### Para avançado:

1. Leia: [04_FEATURE_FLAGS.md](04_FEATURE_FLAGS.md)
2. Crie: Sua primeira feature flag
3. Teste: Rollout gradual

---

## 📂 Estrutura de Pastas

```
KitchenCoast_V1/
├── GUIAS/                          (← Você está aqui!)
│   ├── 00_INDICE.md               (Este arquivo)
│   ├── 01_CICD_TESTES.md
│   ├── 02_AUTO_DEPLOY_STAGING.md
│   ├── 02b_AUTO_DEPLOY_PRODUCAO.md (NOVO - Deploy em Produção)
│   ├── 03_SENTRY_MONITORING.md
│   ├── 04_FEATURE_FLAGS.md
│   ├── 05_VSCODE_TUTORIAL.md
│   └── 06_TROUBLESHOOTING.md
│
├── .github/
│   └── workflows/                 (Workflows GitHub Actions)
│       ├── test.yml               (CI/CD)
│       ├── deploy-staging.yml     (Auto-deploy Staging)
│       └── deploy.yml             (Auto-deploy Produção - NOVO)
│
├── artifacts/kitchencost/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── sentry.js         (Monitoring)
│   │   │   └── featureFlags.js   (Feature Flags)
│   │   ├── hooks/
│   │   │   └── useFeatureFlag.js  (Hook para flags)
│   │   └── main.tsx              (Inicia Sentry)
│   ├── .env                      (Configurações locais)
│   └── .env.example              (Template)
│
├── DEPLOYMENT.md                  (Deploy & Rollout)
└── FEATURE_FLAGS_GUIDE.md        (Guia detalhado)
```

---

## 🎯 Objetivos de cada Ação

| Ação | Objetivo | Benefício |
|------|----------|-----------|
| **CI/CD** | Rodar testes automaticamente | Evita código quebrado em produção |
| **Auto-Deploy** | Staging sempre atualizado | QA testa mais rápido |
| **Sentry** | Rastrear erros em produção | Sabe quando app quebra |
| **Feature Flags** | Ativar/desativar sem deploy | Rollback instantâneo |

---

## 🔗 Links Úteis

- **GitHub do Projeto**: https://github.com/nathaliamachado9013-sys/KitchenCoast_V1
- **GitHub Actions**: https://github.com/nathaliamachado9013-sys/KitchenCoast_V1/actions
- **Sentry Dashboard**: https://sentry.io/
- **Firebase Console**: https://console.firebase.google.com/
- **Documentação Oficial**:
  - [Firebase Docs](https://firebase.google.com/docs)
  - [GitHub Actions](https://docs.github.com/en/actions)
  - [Sentry Docs](https://docs.sentry.io/)

---

## 💡 Dicas

1. **Bookmark esta pasta** no VSCode (File → Add Folder to Workspace)
2. **Leia um guia por dia** - não é necessário ler tudo de uma vez
3. **Teste enquanto lê** - abra os arquivos mencionados
4. **Salve em favoritos** - todos os links importantes

---

## ❓ Precisa de Ajuda?

Se tiver dúvidas:

1. Procure em [06_TROUBLESHOOTING.md](06_TROUBLESHOOTING.md)
2. Veja o guia específico (ex: [03_SENTRY_MONITORING.md](03_SENTRY_MONITORING.md))
3. Procure no Google: "GitHub Actions", "Sentry", "React Hooks"
4. Pergunte no Discord/Slack do projeto

---

## 📊 Estatísticas

- **Total de guias**: 7 (incluindo 02b - Deploy em Produção)
- **Total de linhas**: ~2500+
- **Tempo total de leitura**: ~65 minutos
- **Exemplos de código**: 40+
- **Workflows CI/CD**: 3 (test, deploy-staging, deploy-prod)
- **Screenshots**: Descritos em ASCII

---

**Última atualização**: 2026-06-17  
**Versão do KitchenCoast**: 1.2.1  
**Status**: ✅ Completo com Auto-Deploy em Produção
