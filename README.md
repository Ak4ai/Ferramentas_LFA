# Analisador e Gerador de Autômatos Finitos Determinísticos (AFD)

Esta é uma ferramenta para criar, analisar e visualizar Autômatos Finitos Determinísticos (AFD). O projeto inclui uma interface gráfica (GUI) e uma interface de linha de comando (CLI) para interagir com os AFDs.

## Funcionalidades

- **Interface Gráfica (GUI):**
  - **Carregar AFD:** Carrega a definição de um AFD a partir de um arquivo de texto (`.txt`).
  - **Visualização de Diagrama:** Gera e exibe um diagrama visual do AFD carregado.
  - **Geração de Palavras:** Gera e lista todas as palavras aceitas pelo AFD até um comprimento máximo especificado.
  - **Teste de Palavras:** Permite testar se uma palavra específica é aceita ou rejeitada, mostrando o caminho percorrido nos estados.
  - **Sugestões de Arquivos:** Exibe uma galeria de AFDs disponíveis na pasta do projeto, com pré-visualização dos diagramas.

- **Interface de Linha de Comando (CLI):**
  - Permite definir um AFD interativamente ou carregar de um arquivo.
  - Gera palavras aceitas.
  - Testa palavras específicas e mostra o caminho.

## Como Usar

### Pré-requisitos

Certifique-se de ter Python 3 instalado. Você também precisará instalar as seguintes bibliotecas:

```bash
pip install graphviz pillow
```

**Observação:** A biblioteca `graphviz` também requer que o software Graphviz seja instalado em seu sistema. Você pode baixá-lo em [https://graphviz.org/download/](https://graphviz.org/download/).

### Executando a Interface Gráfica

Para iniciar a aplicação com a interface gráfica, execute o seguinte comando no terminal:

```bash
python afd_gui.py
```

### Executando pela Linha de Comando

Para usar a versão de linha de comando, execute:

```bash
python afd_generator.py
```

O script oferecerá a opção de carregar um AFD de um arquivo ou defini-lo interativamente.

## Formato do Arquivo de Definição do AFD

Para carregar um AFD, crie um arquivo `.txt` com a seguinte estrutura:

```
Estados: q0,q1,q2
Alfabeto: a,b
Estado_inicial: q0
Estados_finais: q2
Transicoes:
q0,a,q1
q0,b,q0
q1,a,q1
q1,b,q2
q2,a,q2
q2,b,q2
```

- **Estados:** Lista de todos os estados, separados por vírgula.
- **Alfabeto:** Lista de todos os símbolos do alfabeto, separados por vírgula.
- **Estado_inicial:** O estado inicial do AFD.
- **Estados_finais:** Lista dos estados de aceitação, separados por vírgula.
- **Transicoes:** Cada linha representa uma transição no formato `estado_origem,simbolo,estado_destino`.

Exemplos de arquivos de AFD (`.txt`) estão incluídos neste projeto.