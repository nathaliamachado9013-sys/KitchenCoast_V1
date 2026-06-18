#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para Popular Dados usando navegador Chrome já aberto
Conecta ao Chrome via Remote Debugging Port
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import json
import time
import subprocess
import socket
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

# Verificar se Chrome já está rodando com debug
def check_chrome_debug():
    """Verifica se Chrome está rodando com debug remoto"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', 9222))
        sock.close()
        return result == 0
    except:
        return False

def start_chrome_debug():
    """Inicia Chrome com debug remoto"""
    print("[*] Iniciando Chrome com debug remoto...")

    chrome_path = None
    possible_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]

    for path in possible_paths:
        try:
            import os
            if os.path.exists(path):
                chrome_path = path
                break
        except:
            pass

    if not chrome_path:
        print("[!] Chrome não encontrado em locais conhecidos")
        print("[!] Inicie Chrome manualmente com:")
        print("    chrome.exe --remote-debugging-port=9222")
        return False

    try:
        # Tentar iniciar Chrome com debug
        subprocess.Popen([
            chrome_path,
            '--remote-debugging-port=9222',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--enable-automation',
            'https://kitchencost-e1a2e.web.app'
        ])

        time.sleep(3)
        print("[+] Chrome iniciado com debug remoto na porta 9222")
        return True
    except Exception as e:
        print(f"[!] Erro ao iniciar Chrome: {e}")
        return False

def connect_to_chrome():
    """Conecta ao Chrome via debug remoto"""
    print("[*] Conectando ao Chrome via Remote Debugging Protocol...")

    if not check_chrome_debug():
        print("[!] Chrome com debug remoto não está rodando")
        if not start_chrome_debug():
            print("[!] Não conseguiu iniciar Chrome")
            return None

    try:
        options = Options()
        options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

        driver = webdriver.Chrome(options=options)
        print("[+] Conectado ao Chrome!")
        return driver
    except Exception as e:
        print(f"[!] Erro ao conectar: {e}")
        return None

def main():
    print("=" * 60)
    print("Pizza Napoletana - Preenchimento de Dados")
    print("=" * 60)
    print()

    driver = connect_to_chrome()
    if not driver:
        print("\n[!] OPÇÃO: Inicie Chrome manualmente:")
        print("    1. Feche todas as janelas do Chrome")
        print("    2. Execute no Powershell/CMD:")
        print("       chrome.exe --remote-debugging-port=9222")
        print("    3. Navegue até: https://kitchencost-e1a2e.web.app")
        print("    4. Faça login")
        print("    5. Execute este script novamente")
        return False

    try:
        # Verificar se está na página certa
        driver.get("https://kitchencost-e1a2e.web.app/ingredientes")
        time.sleep(2)

        print("[+] Página carregada com sucesso!")
        print("[+] Você pode agora interagir com a página")
        print("[+] Script está aguardando...")

        input("Pressione Enter para continuar...")

        return True

    finally:
        # Não fechar o driver para manter o navegador aberto
        pass

if __name__ == '__main__':
    main()
