#!/usr/bin/env node

/**
 * Script para popular dados da Pizzaria Napoletana via Puppeteer
 * Automatiza cliques e digitação na interface do app
 */

const puppeteer = require('puppeteer');

const APP_URL = 'http://localhost:5173'; // Dev server local
// Se estiver em produção, use: 'https://kitchencost-e1a2e.web.app'

const INGREDIENTS = [
  { name: 'Farinha de Trigo', category: 'Grãos', unit: 'kg', cost: '8.00' },
  { name: 'Tomates Pelados', category: 'Produtos Enlatados', unit: 'lata', cost: '0.90' },
  { name: 'Azeite Extravirgem', category: 'Óleos', unit: 'L', cost: '8.00' },
  { name: 'Sal Marinho', category: 'Temperos', unit: 'kg', cost: '2.00' },
  { name: 'Fermento Fresco', category: 'Fermentação', unit: 'kg', cost: '12.00' },
  { name: 'Manjericão Fresco', category: 'Ervas', unit: 'kg', cost: '15.00' },
  { name: 'Mozzarella Fresca', category: 'Queijos', unit: 'kg', cost: '10.00' },
  { name: 'Presunto Ibérico', category: 'Embutidos', unit: 'kg', cost: '22.00' },
  { name: 'Ovos Extra', category: 'Ovos', unit: 'dúzia', cost: '2.00' },
  { name: 'Azeitonas Pretas', category: 'Conservas', unit: 'kg', cost: '6.00' },
  { name: 'Água Mineral', category: 'Bebidas', unit: 'garrafa', cost: '0.50' },
  { name: 'Refrigerante Cola', category: 'Bebidas', unit: 'garrafa', cost: '1.50' },
  { name: 'Vinho Branco', category: 'Bebidas Alcoólicas', unit: 'garrafa', cost: '5.00' },
  { name: 'Vinho Tinto', category: 'Bebidas Alcoólicas', unit: 'garrafa', cost: '8.00' },
];

const SUPPLIER = {
  name: 'Makro Portugal',
  contact: 'Gestor de Contas',
  phone: '(+351) 253 100 100',
  email: 'contato@makro.pt',
  address: 'Rua da Indústria, 123, 4715-390 Braga',
};

let browser;
let page;

async function init() {
  console.log('🚀 Iniciando Puppeteer...\n');

  browser = await puppeteer.launch({
    headless: false, // Mostrar janela do navegador
    args: ['--disable-notifications'],
  });

  page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  // Simular comportamento de usuário real
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  );

  console.log(`📱 Abrindo app: ${APP_URL}\n`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2' });

  // Aguardar login (usuário faz manualmente se necessário)
  console.log('⏳ Aguardando login...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});

  // Se ainda não autenticado, avisar
  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('[data-testid="user-menu"]') ||
           !!localStorage.getItem('user');
  });

  if (!isLoggedIn) {
    console.log('⚠️  Você precisa fazer login manualmente no navegador');
    console.log('📧 Faça login com sua conta Google/Email');
    console.log('✅ Após logar, o script continuará automaticamente...\n');

    // Aguardar até 2 minutos pelo login
    let loggedIn = false;
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(5000);
      const logged = await page.evaluate(() => {
        return !!document.querySelector('[data-testid="user-menu"]') ||
               !!localStorage.getItem('user');
      });
      if (logged) {
        loggedIn = true;
        break;
      }
      process.stdout.write('.');
    }

    if (!loggedIn) {
      throw new Error('❌ Timeout: Você não fez login em tempo');
    }
    console.log('\n✅ Login detectado!\n');
  }
}

async function addIngredient(ingredient) {
  console.log(`  ⏳ Adicionando: ${ingredient.name}...`);

  try {
    // Navegar para Ingredientes
    await page.click('a:has-text("Ingredientes"), [href*="ingredientes"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await page.waitForTimeout(1000);

    // Clicar em "Novo Ingrediente"
    await page.click('button:has-text("Novo Ingrediente"), button:contains("Novo"), button:contains("Adicionar")');
    await page.waitForTimeout(1000);

    // Preencher formulário
    // Nome
    await page.type('input[placeholder*="Nome"], input[name*="name"], input#name', ingredient.name);
    await page.waitForTimeout(300);

    // Categoria - selecionar em dropdown
    await page.click('select[name*="category"], select#category');
    await page.select('select', ingredient.category);
    await page.waitForTimeout(300);

    // Unidade
    await page.type('input[placeholder*="Unidade"], input[name*="unit"], input#unit', ingredient.unit);
    await page.waitForTimeout(300);

    // Custo
    await page.type('input[placeholder*="Custo"], input[name*="cost"], input#cost', ingredient.cost);
    await page.waitForTimeout(300);

    // Clickar "Salvar"
    await page.click('button:has-text("Salvar"), button:contains("Save"), button:contains("OK")');
    await page.waitForTimeout(1500);

    console.log(`  ✅ ${ingredient.name} adicionado`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao adicionar ${ingredient.name}: ${error.message}`);
  }
}

async function addSupplier() {
  console.log(`\n🏪 Adicionando fornecedor: ${SUPPLIER.name}...`);

  try {
    // Navegar para Fornecedores
    await page.click('a:has-text("Fornecedores"), [href*="fornecedores"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await page.waitForTimeout(1000);

    // Clicar em "Novo Fornecedor"
    await page.click('button:has-text("Novo Fornecedor"), button:contains("Novo"), button:contains("Adicionar")');
    await page.waitForTimeout(1000);

    // Preencher formulário
    await page.type('input[placeholder*="Nome"], input[name*="name"], input#name', SUPPLIER.name);
    await page.waitForTimeout(300);

    await page.type('input[placeholder*="Responsável"], input[name*="contact"], input#contact', SUPPLIER.contact);
    await page.waitForTimeout(300);

    await page.type('input[placeholder*="Telefone"], input[name*="phone"], input#phone', SUPPLIER.phone);
    await page.waitForTimeout(300);

    await page.type('input[placeholder*="Email"], input[name*="email"], input#email', SUPPLIER.email);
    await page.waitForTimeout(300);

    await page.type('input[placeholder*="Endereço"], input[name*="address"], input#address', SUPPLIER.address);
    await page.waitForTimeout(300);

    // Clickar "Salvar"
    await page.click('button:has-text("Salvar"), button:contains("Save"), button:contains("OK")');
    await page.waitForTimeout(1500);

    console.log(`  ✅ ${SUPPLIER.name} adicionado`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao adicionar fornecedor: ${error.message}`);
  }
}

async function run() {
  try {
    await init();

    console.log('📦 Adicionando ingredientes...\n');
    for (const ingredient of INGREDIENTS) {
      await addIngredient(ingredient);
      await page.waitForTimeout(500); // Delay entre adições
    }

    await addSupplier();

    console.log('\n✨ Seed completado com sucesso!');
    console.log('📊 Resumo:');
    console.log(`  - ${INGREDIENTS.length} ingredientes adicionados`);
    console.log(`  - 1 fornecedor adicionado`);
    console.log('\n⏳ Navegador continuará aberto para verificação...');
    console.log('Feche a janela quando terminar.');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

// Executar
run();
