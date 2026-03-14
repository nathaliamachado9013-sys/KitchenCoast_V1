# KitchenCoast

Sistema de gestão de custos para restaurantes — SaaS completo construído com React + Firebase.

## Funcionalidades

- **Dashboard** com métricas em tempo real
- **Fichas Técnicas** com calculadora de custo e margem
- **Cardápio** com engenharia de menu
- **Estoque** com alertas de estoque baixo
- **Produção** com cálculo de custo pelos preços atuais
- **Vendas** por canal (balcão, delivery, iFood, etc.)
- **Relatórios** de rentabilidade e margens
- **Custos Fixos** mensais que afetam automaticamente as receitas
- **Autenticação** com Google e email/senha

## Tecnologias

- React + Vite
- Firebase Auth
- Firestore
- shadcn/ui + Tailwind CSS
- React Router

## Como rodar localmente

1. Clone o repositório
2. Copie o arquivo de variáveis de ambiente:
   ```
   cp .env.example .env
   ```
3. Preencha o `.env` com suas chaves do Firebase
4. Instale as dependências:
   ```
   npm install
   ```
5. Rode o projeto:
   ```
   npm run dev
   ```

## Deploy

O projeto está configurado para Firebase Hosting. Para fazer o deploy:

```
npm run build
firebase deploy
```

## Segurança

As regras do Firestore (`firestore.rules`) garantem que cada usuário só acessa os dados do próprio restaurante.
