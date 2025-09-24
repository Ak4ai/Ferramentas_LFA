#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de palavras para Autômato Finito Determinístico (AFD)
Permite definir um AFD através de texto e gerar todas as palavras aceitas
até um tamanho máximo especificado.
"""

from collections import deque
import json
from graphviz import Digraph

class AFD:
    def __init__(self):
        self.estados = set()
        self.alfabeto = set()
        self.transicoes = {}
        self.estado_inicial = None
        self.estados_finais = set()
    
    def carregar_de_texto(self, arquivo_texto):
        """
        Carrega AFD de um arquivo de texto com formato específico.
        
        Formato do arquivo:
        Estados: q0,q1,q2
        Alfabeto: a,b
        Estado_inicial: q0
        Estados_finais: q1,q2
        Transicoes:
        q0,a,q1
        q0,b,q0
        q1,a,q2
        q1,b,q1
        """
        with open(arquivo_texto, 'r', encoding='utf-8') as f:
            linhas = [linha.strip() for linha in f.readlines() if linha.strip()]
        
        i = 0
        while i < len(linhas):
            linha = linhas[i]
            
            if linha.startswith('Estados:'):
                estados_str = linha.split(':', 1)[1].strip()
                self.estados = set(estado.strip() for estado in estados_str.split(','))
            
            elif linha.startswith('Alfabeto:'):
                alfabeto_str = linha.split(':', 1)[1].strip()
                self.alfabeto = set(simbolo.strip() for simbolo in alfabeto_str.split(','))
            
            elif linha.startswith('Estado_inicial:'):
                self.estado_inicial = linha.split(':', 1)[1].strip()
            
            elif linha.startswith('Estados_finais:'):
                finais_str = linha.split(':', 1)[1].strip()
                self.estados_finais = set(estado.strip() for estado in finais_str.split(','))
            
            elif linha.startswith('Transicoes:'):
                i += 1
                while i < len(linhas):
                    partes = linhas[i].split(',')
                    if len(partes) == 3:
                        estado_origem = partes[0].strip()
                        simbolo = partes[1].strip()
                        estado_destino = partes[2].strip()
                        
                        if estado_origem not in self.transicoes:
                            self.transicoes[estado_origem] = {}
                        self.transicoes[estado_origem][simbolo] = estado_destino
                    i += 1
                break
            
            i += 1
    
    def carregar_interativo(self):
        """Carrega AFD através de entrada interativa do usuário."""
        print("=== Definição do AFD ===")
        
        # Estados
        estados_input = input("Digite os estados separados por vírgula (ex: q0,q1,q2): ")
        self.estados = set(estado.strip() for estado in estados_input.split(','))
        
        # Alfabeto
        alfabeto_input = input("Digite o alfabeto separado por vírgula (ex: a,b): ")
        self.alfabeto = set(simbolo.strip() for simbolo in alfabeto_input.split(','))
        
        # Estado inicial
        while True:
            self.estado_inicial = input("Digite o estado inicial: ").strip()
            if self.estado_inicial in self.estados:
                break
            print(f"Estado '{self.estado_inicial}' não está na lista de estados!")
        
        # Estados finais
        finais_input = input("Digite os estados finais separados por vírgula: ")
        self.estados_finais = set(estado.strip() for estado in finais_input.split(','))
        
        # Validar estados finais
        for estado in self.estados_finais:
            if estado not in self.estados:
                print(f"Aviso: Estado final '{estado}' não está na lista de estados!")
        
        # Transições
        print("\n=== Definição das Transições ===")
        print("Digite as transições no formato: estado_origem,simbolo,estado_destino")
        print("Digite 'fim' para terminar")
        
        while True:
            transicao = input("Transição: ").strip()
            if transicao.lower() == 'fim':
                break
                
            partes = transicao.split(',')
            if len(partes) == 3:
                estado_origem = partes[0].strip()
                simbolo = partes[1].strip()
                estado_destino = partes[2].strip()
                
                # Validações
                if estado_origem not in self.estados:
                    print(f"Estado origem '{estado_origem}' não existe!")
                    continue
                if simbolo not in self.alfabeto:
                    print(f"Símbolo '{simbolo}' não está no alfabeto!")
                    continue
                if estado_destino not in self.estados:
                    print(f"Estado destino '{estado_destino}' não existe!")
                    continue
                
                if estado_origem not in self.transicoes:
                    self.transicoes[estado_origem] = {}
                self.transicoes[estado_origem][simbolo] = estado_destino
                print(f"Transição adicionada: {estado_origem} --{simbolo}--> {estado_destino}")
            else:
                print("Formato inválido! Use: estado_origem,simbolo,estado_destino")
    
    def processar_palavra(self, palavra):
        """
        Processa uma palavra no AFD e retorna True se for aceita.
        """
        estado_atual = self.estado_inicial
        
        for simbolo in palavra:
            if simbolo not in self.alfabeto:
                return False
            
            if estado_atual not in self.transicoes or simbolo not in self.transicoes[estado_atual]:
                return False
            
            estado_atual = self.transicoes[estado_atual][simbolo]
        
        return estado_atual in self.estados_finais
    
    def processar_palavra_com_caminho(self, palavra):
        """
        Processa uma palavra no AFD e retorna o caminho completo.
        """
        estado_atual = self.estado_inicial
        caminho = [estado_atual]
        
        for simbolo in palavra:
            if simbolo not in self.alfabeto:
                return False, caminho, f"Símbolo '{simbolo}' não está no alfabeto"
            
            if estado_atual not in self.transicoes or simbolo not in self.transicoes[estado_atual]:
                return False, caminho, f"Não há transição de {estado_atual} com '{simbolo}'"
            
            estado_atual = self.transicoes[estado_atual][simbolo]
            caminho.append(estado_atual)
        
        aceita = estado_atual in self.estados_finais
        msg = f"Estado final {estado_atual} {'é' if aceita else 'não é'} estado de aceitação"
        return aceita, caminho, msg

    def gerar_diagrama_png(self):
        """Gera um diagrama visual do AFD e o salva como um arquivo PNG."""
        dot = Digraph(comment='Diagrama do AFD')
        dot.attr(rankdir='LR', size='8,5')

        # Nós
        for estado in self.estados:
            if estado in self.estados_finais:
                dot.node(estado, shape='doublecircle')
            else:
                dot.node(estado, shape='circle')

        # Nó de início invisível para a seta inicial
        dot.node('inicio', '', shape='none', width='0', height='0')
        dot.edge('inicio', self.estado_inicial)

        # Transições
        for estado_origem, transicoes in self.transicoes.items():
            for simbolo, estado_destino in transicoes.items():
                dot.edge(estado_origem, estado_destino, label=simbolo)
        
        try:
            dot.render('diagrama_afd', view=False, cleanup=True, format='png')
            return "diagrama_afd.png"
        except Exception as e:
            print(f"Erro ao gerar diagrama: {e}")
            return None

    def gerar_diagrama_com_thumbnail(self, nome_base="diagrama_afd"):
        """Gera diagrama principal e thumbnail para pré-visualização."""
        try:
            from PIL import Image
            
            # Gerar diagrama principal
            dot = Digraph(comment='Diagrama do AFD')
            dot.attr(rankdir='LR', size='8,5')

            # Nós
            for estado in self.estados:
                if estado in self.estados_finais:
                    dot.node(estado, shape='doublecircle')
                else:
                    dot.node(estado, shape='circle')

            # Nó de início invisível para a seta inicial
            dot.node('inicio', '', shape='none', width='0', height='0')
            dot.edge('inicio', self.estado_inicial)

            # Transições
            for estado_origem, transicoes in self.transicoes.items():
                for simbolo, estado_destino in transicoes.items():
                    dot.edge(estado_origem, estado_destino, label=simbolo)
            
            # Gerar diagrama principal
            diagrama_path = dot.render(nome_base, view=False, cleanup=True, format='png')
            
            # Gerar thumbnail
            img = Image.open(diagrama_path)
            img.thumbnail((100, 100), Image.Resampling.LANCZOS)
            thumbnail_path = f"{nome_base}_thumb.png"
            img.save(thumbnail_path, "PNG")
            
            return diagrama_path, thumbnail_path
        except Exception as e:
            print(f"Erro ao gerar diagrama com thumbnail: {e}")
            return None, None

    def gerar_palavras(self, tamanho_maximo=5):
        """
        Gera todas as palavras aceitas pelo AFD até um tamanho máximo.
        """
        palavras_aceitas = set()
        
        # Verificar se o estado inicial é final (palavra vazia)
        if self.estado_inicial in self.estados_finais:
            palavras_aceitas.add("ε (palavra vazia)")
        
        # Gerar todas as palavras possíveis de cada tamanho
        for tamanho in range(1, tamanho_maximo + 1):
            self._gerar_palavras_tamanho(tamanho, palavras_aceitas)
        
        return sorted(list(palavras_aceitas))
    
    def _gerar_palavras_tamanho(self, tamanho, palavras_aceitas):
        """
        Gera todas as palavras de um tamanho específico.
        """
        def gerar_recursivo(palavra_atual, estado_atual, tamanho_restante):
            if tamanho_restante == 0:
                # Chegou ao tamanho desejado, verificar se está em estado final
                if estado_atual in self.estados_finais:
                    palavras_aceitas.add(palavra_atual)
                return
            
            # Continuar explorando
            if estado_atual in self.transicoes:
                for simbolo in self.alfabeto:
                    if simbolo in self.transicoes[estado_atual]:
                        proximo_estado = self.transicoes[estado_atual][simbolo]
                        nova_palavra = palavra_atual + simbolo
                        gerar_recursivo(nova_palavra, proximo_estado, tamanho_restante - 1)
        
        # Começar a partir do estado inicial
        gerar_recursivo("", self.estado_inicial, tamanho)
    
    def imprimir_afd(self):
        """Imprime a definição do AFD."""
        print("\n=== Definição do AFD ===")
        print(f"Estados: {sorted(self.estados)}")
        print(f"Alfabeto: {sorted(self.alfabeto)}")
        print(f"Estado inicial: {self.estado_inicial}")
        print(f"Estados finais: {sorted(self.estados_finais)}")
        print("\nTransições:")
        for estado_origem in sorted(self.transicoes.keys()):
            for simbolo in sorted(self.transicoes[estado_origem].keys()):
                estado_destino = self.transicoes[estado_origem][simbolo]
                print(f"  {estado_origem} --{simbolo}--> {estado_destino}")

def main():
    print("=== Gerador de Palavras para AFD ===\n")
    
    afd = AFD()
    
    # Opções de entrada
    print("Como você quer definir o AFD?")
    print("1. Carregando de arquivo")
    print("2. Entrada interativa")
    
    while True:
        opcao = input("\nEscolha uma opção (1 ou 2): ").strip()
        if opcao in ['1', '2']:
            break
        print("Opção inválida!")
    
    if opcao == '1':
        arquivo = input("Digite o nome do arquivo (ex: afd.txt): ").strip()
        try:
            afd.carregar_de_texto(arquivo)
            print("AFD carregado com sucesso!")
        except FileNotFoundError:
            print(f"Arquivo '{arquivo}' não encontrado!")
            return
        except Exception as e:
            print(f"Erro ao carregar arquivo: {e}")
            return
    else:
        afd.carregar_interativo()
    
    # Imprimir AFD
    afd.imprimir_afd()

    # Perguntar se deseja visualizar o diagrama
    while True:
        ver_diagrama = input("\nDeseja visualizar o diagrama do AFD? (s/n): ").strip().lower()
        if ver_diagrama in ['s', 'sim']:
            afd.visualizar_diagrama()
            break
        elif ver_diagrama in ['n', 'nao', 'não']:
            break
        else:
            print("Opção inválida. Digite 's' para sim ou 'n' para não.")
    
    # Gerar palavras
    while True:
        try:
            tamanho_max = int(input("\nDigite o tamanho máximo das palavras a gerar (recomendado: 5-10): "))
            if tamanho_max > 0:
                break
            print("Tamanho deve ser maior que 0!")
        except ValueError:
            print("Digite um número válido!")
    
    print(f"\nGerando palavras aceitas de tamanho até {tamanho_max}...")
    palavras = afd.gerar_palavras(tamanho_max)
    
    print(f"\n=== Palavras aceitas (total: {len(palavras)}) ===")
    if palavras:
        for i, palavra in enumerate(palavras, 1):
            print(f"{i:3d}. {palavra}")
    else:
        print("Nenhuma palavra encontrada!")
    
    # Opção de testar palavras específicas
    print("\n=== Teste de palavras específicas ===")
    print("Digite palavras para testar (digite 'sair' para terminar):")
    print("Use 'epsilon' ou 'ε' para testar a palavra vazia")
    
    while True:
        palavra_teste = input("Palavra: ").strip()
        if palavra_teste.lower() == 'sair':
            break
        
        # Tratar palavra vazia
        if palavra_teste.lower() in ['epsilon', 'ε', '']:
            palavra_teste = ""
            print("Testando palavra vazia (ε)...")
        
        aceita, caminho, msg = afd.processar_palavra_com_caminho(palavra_teste)
        
        if aceita:
            print(f"✓ A palavra '{palavra_teste if palavra_teste else 'ε'}' é ACEITA pelo AFD")
        else:
            print(f"✗ A palavra '{palavra_teste if palavra_teste else 'ε'}' é REJEITADA pelo AFD")
        
        # Mostrar caminho
        caminho_str = " → ".join(caminho)
        print(f"  Caminho: {caminho_str}")
        print(f"  {msg}")
        print()

if __name__ == "__main__":
    main()
