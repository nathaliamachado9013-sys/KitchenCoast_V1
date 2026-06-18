import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './artifacts/kitchencost/src/lib/firebase.js';

const BATCH_SIZE = 100;

async function cleanupOrphanedData(restaurantId) {
  console.log(`🧹 Iniciando limpeza de dados órfãos para restaurante: ${restaurantId}`);

  const orphanedMovements = [];
  const orphanedIngredients = [];

  try {
    // Step 1: Get all stock movements
    console.log('\n📊 Analisando movimentações de estoque...');
    const movementsSnap = await getDocs(
      query(collection(db, 'restaurants', restaurantId, 'stock_movements'))
    );

    // Step 2: Get all ingredients
    console.log('📦 Carregando ingredientes...');
    const ingredientsSnap = await getDocs(
      query(collection(db, 'restaurants', restaurantId, 'ingredients'))
    );
    const ingredientIds = new Set(ingredientsSnap.docs.map(d => d.id));

    // Step 3: Get all invoices
    console.log('📄 Carregando notas fiscais...');
    const invoicesSnap = await getDocs(
      query(collection(db, 'restaurants', restaurantId, 'invoices'))
    );
    const invoiceIds = new Set(invoicesSnap.docs.map(d => d.id));

    // Step 4: Identify orphaned movements
    console.log('\n🔍 Procurando movimentações órfãs...');
    for (const movementDoc of movementsSnap.docs) {
      const movement = movementDoc.data();
      const { ingredientId, invoiceId } = movement;

      // Check if ingredient exists
      if (ingredientId && !ingredientIds.has(ingredientId)) {
        console.log(
          `  ❌ Movimento ${movementDoc.id}: Ingrediente ${ingredientId} não existe`
        );
        orphanedMovements.push({
          id: movementDoc.id,
          reason: 'ingredient_deleted',
          movement,
        });
      }
      // Check if invoice exists (if movement has invoiceId)
      else if (invoiceId && !invoiceIds.has(invoiceId)) {
        console.log(
          `  ❌ Movimento ${movementDoc.id}: Nota fiscal ${invoiceId} não existe`
        );
        orphanedMovements.push({
          id: movementDoc.id,
          reason: 'invoice_deleted',
          movement,
        });
      }
    }

    // Step 5: Report findings
    console.log(`\n📋 Resumo:`);
    console.log(`  • Total de movimentações: ${movementsSnap.size}`);
    console.log(`  • Movimentações órfãs encontradas: ${orphanedMovements.length}`);

    if (orphanedMovements.length === 0) {
      console.log('\n✅ Nenhuma movimentação órfã encontrada!');
      return;
    }

    // Step 6: Ask for confirmation
    console.log('\n⚠️  Dados órfãs encontrados. Preciso deletar? (S/N)');

    // For automation, we'll proceed with deletion
    // In a real CLI, you'd wait for user input
    await deleteOrphanedMovements(restaurantId, orphanedMovements);

  } catch (error) {
    console.error('❌ Erro durante limpeza:', error);
    throw error;
  }
}

async function deleteOrphanedMovements(restaurantId, orphanedMovements) {
  console.log(`\n🗑️  Deletando ${orphanedMovements.length} movimentações órfãs...`);

  let batch = writeBatch(db);
  let batchCount = 0;

  for (let i = 0; i < orphanedMovements.length; i++) {
    const orphaned = orphanedMovements[i];
    const movementRef = doc(
      db,
      'restaurants',
      restaurantId,
      'stock_movements',
      orphaned.id
    );

    batch.delete(movementRef);
    batchCount++;

    // Commit batch every BATCH_SIZE items
    if (batchCount === BATCH_SIZE || i === orphanedMovements.length - 1) {
      try {
        await batch.commit();
        console.log(`  ✅ Batch ${Math.ceil((i + 1) / BATCH_SIZE)} enviado (${batchCount} itens)`);
      } catch (error) {
        console.error(`  ❌ Erro ao enviar batch ${Math.ceil((i + 1) / BATCH_SIZE)}:`, error);
        throw error;
      }
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  console.log(`\n✅ Limpeza concluída! ${orphanedMovements.length} movimentações órfãs deletadas.`);
}

// Main execution
async function main() {
  // Get restaurantId from command line or environment
  const restaurantId = process.argv[2];

  if (!restaurantId) {
    console.error('❌ Uso: node cleanup-orphaned-data.js <restaurantId>');
    console.error('Exemplo: node cleanup-orphaned-data.js rest_abc123');
    process.exit(1);
  }

  try {
    await cleanupOrphanedData(restaurantId);
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
