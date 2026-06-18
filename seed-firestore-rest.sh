#!/bin/bash

# Script para adicionar dados à Pizzaria Napoletana via Firestore REST API
# Requer: curl, jq
# Uso: bash seed-firestore-rest.sh

PROJECT_ID="your-firebase-project-id"
RESTAURANT_ID="pizza-napoletana"
API_KEY="your-firebase-api-key"
FIRESTORE_URL="https://firestore.googleapis.com/v1"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 Iniciando seed de dados para Pizzaria Napoletana${NC}\n"

# Função para adicionar ingrediente
add_ingredient() {
  local name=$1
  local category=$2
  local unit=$3
  local cost=$4

  local data=$(cat <<EOF
{
  "fields": {
    "name": {"stringValue": "$name"},
    "category": {"stringValue": "$category"},
    "unitType": {"stringValue": "$unit"},
    "costPerUnit": {"doubleValue": $cost},
    "currentStock": {"doubleValue": 0},
    "minStock": {"doubleValue": 0},
    "createdAt": {"timestampValue": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"},
    "updatedAt": {"timestampValue": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
  }
}
EOF
)

  curl -X POST \
    "${FIRESTORE_URL}/projects/${PROJECT_ID}/databases/(default)/documents/restaurants/${RESTAURANT_ID}/ingredients" \
    -H "Content-Type: application/json" \
    -d "$data" \
    2>/dev/null > /dev/null

  echo -e "${GREEN}✅${NC} $name"
}

# Adicionar ingredientes
echo -e "${BLUE}📦 Adicionando ingredientes...${NC}"
add_ingredient "Farinha de Trigo" "Grãos" "kg" "8.00"
add_ingredient "Tomates Pelados" "Produtos Enlatados" "lata" "0.90"
add_ingredient "Azeite Extravirgem" "Óleos" "L" "8.00"
add_ingredient "Sal Marinho" "Temperos" "kg" "2.00"
add_ingredient "Fermento Fresco" "Fermentação" "kg" "12.00"
add_ingredient "Manjericão Fresco" "Ervas" "kg" "15.00"
add_ingredient "Mozzarella Fresca" "Queijos" "kg" "10.00"
add_ingredient "Presunto Ibérico" "Embutidos" "kg" "22.00"
add_ingredient "Ovos Extra" "Ovos" "dúzia" "2.00"
add_ingredient "Azeitonas Pretas" "Conservas" "kg" "6.00"
add_ingredient "Água Mineral" "Bebidas" "garrafa" "0.50"
add_ingredient "Refrigerante Cola" "Bebidas" "garrafa" "1.50"
add_ingredient "Vinho Branco" "Bebidas Alcoólicas" "garrafa" "5.00"
add_ingredient "Vinho Tinto" "Bebidas Alcoólicas" "garrafa" "8.00"

echo -e "\n✨ ${GREEN}Seed completado!${NC}\n"
