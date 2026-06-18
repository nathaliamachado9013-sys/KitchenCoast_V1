#!/usr/bin/env node

/**
 * Script para extrair credenciais Firebase injetando código no navegador
 * Usa DevTools Protocol via Chrome
 */

const http = require('http');

// Conectar ao Chrome DevTools
const PORT = 9222; // Porta padrão do Chrome Remote Protocol

function queryChrome(method, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ id: 1, method, params });

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/json/protocol',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function extractFirebaseKey() {
  console.log('🔍 Tentando extrair credenciais Firebase...\n');

  console.log('⚠️  Para extrair a API Key automaticamente:');
  console.log('1. Abra Chrome/Edge com flag de Debug Remote Protocol:');
  console.log('   Chrome: chrome.exe --remote-debugging-port=9222\n');
  console.log('2. Ou acesse DevTools manualmente:');
  console.log('   - Abra o app KitchenCoast no navegador');
  console.log('   - Pressione F12 (DevTools)');
  console.log('   - Console');
  console.log('   - Cole o código abaixo e aperte Enter:\n');

  const extractCode = `
// Extrair configuração Firebase da variável de ambiente Vite
console.log('🔑 Suas credenciais Firebase:');
console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY);
console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
console.log('App ID:', import.meta.env.VITE_FIREBASE_APP_ID);

// Ou tente acessar do localStorage/sessionStorage
const storage = { ...localStorage, ...sessionStorage };
const firebaseKeys = Object.keys(storage).filter(k => k.includes('firebase') || k.includes('FIREBASE'));
console.log('\\n🔐 Dados em localStorage:', firebaseKeys);
firebaseKeys.forEach(k => console.log(k, ':', storage[k]?.substring(0, 50) + '...'));
`;

  console.log('=' .repeat(60));
  console.log(extractCode);
  console.log('='.repeat(60));
  console.log('\n\n📋 Copie os valores exibidos e atualize o arquivo:');
  console.log('  C:\\Users\\natha\\Claude\\KitchenCoast_V1\\populate-firestore.js\n');
  console.log('Substitua estas linhas:');
  console.log('  const PROJECT_ID = "kitchencost-e1a2e";');
  console.log('  const API_KEY = "sua_api_key_aqui";\n');
  console.log('Depois execute:');
  console.log('  node populate-firestore.js\n');
}

extractFirebaseKey().catch(console.error);
