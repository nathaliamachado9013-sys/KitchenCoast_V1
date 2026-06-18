#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para Popular Dados da Pizzaria Napoletana no KitchenCoast
Usa Selenium para automatziar a navegação e preenchimento de dados
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import sys

# ============== CONFIGURAÇÃO ==============
APP_URL = 'https://kitchencost-e1a2e.web.app'
# Se quiser testar localmente: 'http://localhost:5173'

INGREDIENTS = [
    {'name': 'Farinha de Trigo', 'category': 'Grãos', 'unit': 'kg', 'cost': '8.00'},
    {'name': 'Tomates Pelados', 'category': 'Produtos Enlatados', 'unit': 'lata', 'cost': '0.90'},
    {'name': 'Azeite Extravirgem', 'category': 'Óleos', 'unit': 'L', 'cost': '8.00'},
    {'name': 'Sal Marinho', 'category': 'Temperos', 'unit': 'kg', 'cost': '2.00'},
    {'name': 'Fermento Fresco', 'category': 'Fermentação', 'unit': 'kg', 'cost': '12.00'},
    {'name': 'Manjericão Fresco', 'category': 'Ervas', 'unit': 'kg', 'cost': '15.00'},
    {'name': 'Mozzarella Fresca', 'category': 'Queijos', 'unit': 'kg', 'cost': '10.00'},
    {'name': 'Presunto Ibérico', 'category': 'Embutidos', 'unit': 'kg', 'cost': '22.00'},
    {'name': 'Ovos Extra', 'category': 'Ovos', 'unit': 'dúzia', 'cost': '2.00'},
    {'name': 'Azeitonas Pretas', 'category': 'Conservas', 'unit': 'kg', 'cost': '6.00'},
    {'name': 'Água Mineral', 'category': 'Bebidas', 'unit': 'garrafa', 'cost': '0.50'},
    {'name': 'Refrigerante Cola', 'category': 'Bebidas', 'unit': 'garrafa', 'cost': '1.50'},
    {'name': 'Vinho Branco', 'category': 'Bebidas Alcoólicas', 'unit': 'garrafa', 'cost': '5.00'},
    {'name': 'Vinho Tinto', 'category': 'Bebidas Alcoólicas', 'unit': 'garrafa', 'cost': '8.00'},
]

SUPPLIER = {
    'name': 'Makro Portugal',
    'contact': 'Gestor de Contas',
    'phone': '(+351) 253 100 100',
    'email': 'contato@makro.pt',
    'address': 'Rua da Indústria, 123, 4715-390 Braga',
}

# ============== FUNÇÕES ==============

def init_driver():
    """Inicializa o driver Selenium"""
    print('🚀 Iniciando Selenium WebDriver...')

    options = webdriver.ChromeOptions()
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=options)
        print('✅ Driver Chrome iniciado\n')
        return driver
    except Exception as e:
        print(f'❌ Erro ao iniciar Chrome: {e}')
        print('📥 Instalando chromedriver via webdriver-manager...')
        try:
            from webdriver_manager.chrome import ChromeDriverManager
            from selenium.webdriver.chrome.service import Service

            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            print('✅ Driver Chrome iniciado (via webdriver-manager)\n')
            return driver
        except ImportError:
            print('❌ Instale webdriver-manager: pip install webdriver-manager')
            sys.exit(1)

def wait_for_element(driver, by, value, timeout=15):
    """Aguarda elemento aparecer"""
    try:
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
    except TimeoutException:
        print(f'⏱️ Timeout aguardando elemento: {value}')
        return None

def click_element(driver, by, value, timeout=15):
    """Clica em elemento com espera"""
    try:
        element = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((by, value))
        )
        element.click()
        return True
    except Exception as e:
        print(f'❌ Erro ao clicar: {e}')
        return False

def type_text(element, text):
    """Digita texto com limpeza prévia"""
    try:
        element.clear()
        element.send_keys(text)
        return True
    except Exception as e:
        print(f'❌ Erro ao digitar: {e}')
        return False

def login_if_needed(driver):
    """Verifica se precisa fazer login"""
    print('🔐 Verificando autenticação...')
    time.sleep(2)

    try:
        # Procura elemento que indica que já está logado
        driver.find_element(By.XPATH, '//*[contains(@class, "user") or contains(@class, "profile")]')
        print('✅ Já está autenticado\n')
        return True
    except NoSuchElementException:
        print('⚠️ Necessário fazer login')
        print('📧 Faça login manualmente na janela do navegador')
        print('✅ Após logar, o script continuará...\n')

        # Aguardar até 3 minutos pelo login
        for i in range(18):
            time.sleep(10)
            try:
                driver.find_element(By.XPATH, '//*[contains(@class, "user") or contains(@class, "profile")]')
                print('✅ Login detectado! Continuando...\n')
                return True
            except:
                print(f'⏳ Aguardando login... ({i+1}/18)')

        print('❌ Timeout: login não realizado')
        return False

def add_ingredient(driver, ingredient):
    """Adiciona um ingrediente"""
    print(f'  ⏳ {ingredient["name"]}...', end=' ', flush=True)

    try:
        # Navegar para Ingredientes
        driver.get(f'{APP_URL}/ingredientes')
        time.sleep(2)

        # Clicar "Novo Ingrediente"
        try:
            click_element(driver, By.XPATH, "//button[contains(., 'Novo') or contains(., 'novo') or contains(., 'Add')]")
        except:
            click_element(driver, By.XPATH, "//a[contains(., 'Novo')]")

        time.sleep(1)

        # Preencher formulário (seletores genéricos que funcionam com a maioria dos frameworks)
        inputs = driver.find_elements(By.TAG_NAME, 'input')
        if len(inputs) >= 4:
            type_text(inputs[0], ingredient['name'])  # Nome
            time.sleep(0.3)
            type_text(inputs[1], ingredient['category'])  # Categoria
            time.sleep(0.3)
            type_text(inputs[2], ingredient['unit'])  # Unidade
            time.sleep(0.3)
            type_text(inputs[3], ingredient['cost'])  # Custo
            time.sleep(0.3)

        # Clicar Salvar
        try:
            click_element(driver, By.XPATH, "//button[contains(., 'Salvar') or contains(., 'Save')]")
        except:
            driver.find_element(By.XPATH, "//button[contains(., 'OK')]").click()

        time.sleep(1.5)
        print('✅')
        return True

    except Exception as e:
        print(f'❌ ({str(e)[:30]})')
        return False

def add_supplier(driver):
    """Adiciona um fornecedor"""
    print(f'\n🏪 Adicionando fornecedor...\n  ⏳ {SUPPLIER["name"]}...', end=' ', flush=True)

    try:
        # Navegar para Fornecedores
        driver.get(f'{APP_URL}/fornecedores')
        time.sleep(2)

        # Clicar "Novo Fornecedor"
        try:
            click_element(driver, By.XPATH, "//button[contains(., 'Novo')]")
        except:
            click_element(driver, By.XPATH, "//a[contains(., 'Novo')]")

        time.sleep(1)

        # Preencher formulário
        inputs = driver.find_elements(By.TAG_NAME, 'input')
        if len(inputs) >= 5:
            type_text(inputs[0], SUPPLIER['name'])  # Nome
            time.sleep(0.3)
            type_text(inputs[1], SUPPLIER['contact'])  # Responsável
            time.sleep(0.3)
            type_text(inputs[2], SUPPLIER['phone'])  # Telefone
            time.sleep(0.3)
            type_text(inputs[3], SUPPLIER['email'])  # Email
            time.sleep(0.3)
            type_text(inputs[4], SUPPLIER['address'])  # Endereço
            time.sleep(0.3)

        # Clicar Salvar
        try:
            click_element(driver, By.XPATH, "//button[contains(., 'Salvar')]")
        except:
            driver.find_element(By.XPATH, "//button[contains(., 'Save')]").click()

        time.sleep(1.5)
        print('✅')
        return True

    except Exception as e:
        print(f'❌ ({str(e)[:30]})')
        return False

def main():
    """Função principal"""
    print('=' * 60)
    print('🍕 PIZZA NAPOLETANA - PREENCHIMENTO DE DADOS')
    print('=' * 60)
    print()

    driver = None
    try:
        driver = init_driver()

        # Navegar para app
        print(f'📱 Abrindo app: {APP_URL}')
        driver.get(APP_URL)
        time.sleep(3)

        # Verificar login
        if not login_if_needed(driver):
            return False

        # Adicionar ingredientes
        print('📦 Adicionando ingredientes:')
        success_count = 0
        for ingredient in INGREDIENTS:
            if add_ingredient(driver, ingredient):
                success_count += 1
            time.sleep(0.5)

        # Adicionar fornecedor
        add_supplier(driver)

        # Resumo
        print('\n' + '=' * 60)
        print('✨ SEED COMPLETADO!')
        print('=' * 60)
        print(f'\n📊 Resumo:')
        print(f'  - {success_count}/{len(INGREDIENTS)} ingredientes adicionados')
        print(f'  - 1 fornecedor adicionado')
        print(f'\n💡 Próximas etapas:')
        print(f'  1. Atualize o navegador (F5)')
        print(f'  2. Navegue para "Ingredientes"')
        print(f'  3. Verifique os dados adicionados')
        print(f'  4. Crie receitas manualmente\n')

        print('⏳ Navegador permanecerá aberto para verificação...')
        print('Feche a janela quando terminar.')

        # Manter navegador aberto
        input('\nPressione Enter para fechar...')

        return True

    except Exception as e:
        print(f'❌ Erro: {e}')
        import traceback
        traceback.print_exc()
        return False

    finally:
        if driver:
            driver.quit()
            print('\n✅ Navegador fechado')

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
