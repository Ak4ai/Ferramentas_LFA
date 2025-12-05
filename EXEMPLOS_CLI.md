# Exemplos de Uso via Linha de Comando

## Sintaxe Básica

### Usando Definição de Texto
```bash
node cli.js --def "<definição>" --lang "<descrição da linguagem>"
```

### Usando Arquivo JSON
```bash
node cli.js --def "arquivo.json" --test "string1,string2,string3"
```

### Usando JSON Direto (Método Iterativo)
```bash
node cli.js --iterativo-json '{"Estados":[...],"Transicoes":[...]}' --lang "<descrição>" --test "strings"
```

## Exemplos Práticos

### 1. AFD que aceita strings começando com "ab"

**Linguagem:** `{w | w ∈ {a, b, c}* e w começa com ab}`

```bash
node cli.js --def "Estados: q0, q1, q2, q3
Alfabeto: a, b, c
Estado_Inicial: q0
Estados_Finais: q2
Transicoes:
q0, a, q1
q0, b, q3
q0, c, q3
q1, b, q2
q1, a, q3
q1, c, q3
q2, a, q2
q2, b, q2
q2, c, q2
q3, a, q3
q3, b, q3
q3, c, q3" --lang "começa com ab"
```

### 2. AFD que aceita strings terminando com "ba"

**Linguagem:** `{w | w ∈ {a, b}* e w termina com ba}`

```bash
node cli.js --def "Estados: q0, q1, q2
Alfabeto: a, b
Estado_Inicial: q0
Estados_Finais: q2
Transicoes:
q0, a, q0
q0, b, q1
q1, a, q2
q1, b, q1
q2, a, q0
q2, b, q1" --lang "termina com ba"
```

### 3. AFD que aceita strings com pelo menos 2 'a's

**Linguagem:** `{w | w ∈ {a, b}* e w contém pelo menos 2 'a'}`

```bash
node cli.js --def "Estados: q0, q1, q2
Alfabeto: a, b
Estado_Inicial: q0
Estados_Finais: q2
Transicoes:
q0, a, q1
q0, b, q0
q1, a, q2
q1, b, q1
q2, a, q2
q2, b, q2" --lang "pelo menos 2 a"
```

### 4. AFD que aceita strings de comprimento par

**Linguagem:** `{w | w ∈ {a, b}* e |w| é par}`

```bash
node cli.js --def "Estados: q0, q1
Alfabeto: a, b
Estado_Inicial: q0
Estados_Finais: q0
Transicoes:
q0, a, q1
q0, b, q1
q1, a, q0
q1, b, q0" --lang "comprimento par"
```

### 5. Com testes customizados

```bash
node cli.js --def "Estados: q0, q1, q2
Alfabeto: a, b
Estado_Inicial: q0
Estados_Finais: q2
Transicoes:
q0, a, q1
q0, b, q0
q1, a, q2
q1, b, q1
q2, a, q2
q2, b, q2" --lang "pelo menos 2 a" --test "aa,aaa,ab,ba,bbb,aab"
```

## Padrões de Linguagem Suportados

O sistema reconhece automaticamente os seguintes padrões na descrição da linguagem:

### Padrões Simples
- **"começa com X"** → `startsWith`
- **"termina com X"** → `endsWith`
- **"contém X"** → `contains`
- **"não contém X"** → `contains` (negado)

### Contagem
- **"pelo menos N X"** → `count` com operador `>=`
- **"exatamente N X"** → `count` com operador `==`
- **"comprimento par"** → `count` de comprimento total com operador `even`
- **"comprimento ímpar"** → `count` de comprimento total com operador `odd`

### Linguagens Estruturadas (Máquinas de Turing)
- **"a^n b^n"** ou **"anbn"** → Reconhece padrão {aⁿbⁿ | n ≥ 0}
- **"a^n b^n c^n"** ou **"anbncn"** → Reconhece padrão {aⁿbⁿcⁿ | n ≥ 0}
- **"mesma quantidade de a e b"** → Reconhece strings com #a = #b
- **"palindromos pares"** ou **"ww^R"** → Reconhece palíndromos de comprimento par

## Validação Automática

Quando você fornece `--lang`, o sistema:
1. **Extrai regras** da descrição
2. **Gera testes aleatórios** (100 para MT, 500 para AFD)
3. **Valida** se a máquina aceita/rejeita corretamente
4. **Salva automaticamente** o JSON e SVG se passar na validação

### Exemplo de Validação Completa

```bash
node cli.js --iterativo-json '{...}' --lang "começa com ab" --test "ab,abc,a,ba"
```

Saída:
```
✓ Regras extraídas da descrição

--- Validação com Regras ---
Executando 500 testes aleatórios...

✓ CORRETO - Sua máquina passou em todos os testes!

--- Testes Customizados ---
  "ab" -> ✓ ACEITA
  "abc" -> ✓ ACEITA
  "a" -> ✗ REJEITA
  "ba" -> ✗ REJEITA

✓ Definição salva em: afd_2025-12-01T19-30-45.json
✓ Diagrama SVG salvo em: afd_2025-12-01T19-30-45.svg
```

## Formato JSON Completo

### Máquina de Turing
```json
{
  "Estados": ["q0", "q1", "qaccept", "qreject"],
  "Alfabeto_Entrada": ["a", "b"],
  "Alfabeto_Fita": ["a", "b", "X", "_"],
  "Simbolo_Branco": "_",
  "Estado_Inicial": "q0",
  "Estado_Aceitacao": "qaccept",
  "Estado_Rejeicao": "qreject",
  "Transicoes": [
    ["q0", "a", "q1", "X", "R"],
    ["q1", "b", "qaccept", "b", "N"]
  ],
  "rules": [
    {
      "rules": [
        {
          "type": "structuredLanguage",
          "value": {
            "pattern": "ab",
            "condition": "i === j"
          },
          "negated": false
        }
      ]
    }
  ]
}
```

### AFD
```json
{
  "states": ["q0", "q1", "q2"],
  "alphabet": ["a", "b"],
  "startState": "q0",
  "finalStates": ["q2"],
  "transitions": {
    "q0": {"a": "q1", "b": "q0"},
    "q1": {"a": "q1", "b": "q2"},
    "q2": {"a": "q1", "b": "q2"}
  },
  "rules": [
    {
      "rules": [
        {
          "type": "contains",
          "value": "ab",
          "negated": false
        }
      ]
    }
  ]
}
```

## Casos de Uso Comuns

### 1. Testar Rapidamente uma Máquina
```bash
node cli.js --iterativo-json '{...}' --test "teste1,teste2,teste3"
```

### 2. Validar com Descrição da Linguagem
```bash
node cli.js --iterativo-json '{...}' --lang "a^n b^n" --test ",ab,aabb"
```

### 3. Debug Detalhado de Execução
```bash
node cli.js --iterativo-json '{...}' --test "aabb" --verbose
```

### 4. Validar e Salvar com Nome Específico
```bash
node cli.js --iterativo-json '{...}' --lang "palindromos" --name "MT_exe1_d"
```

### 5. Usar Arquivo JSON Existente
```bash
node cli.js --def "MT_exe1_e.json" --test "ab,ba,aabb"
```

## Padrões de Linguagem Suportados

O sistema reconhece automaticamente os seguintes padrões:

- **"começa com X"** → `startsWith`
- **"termina com X"** → `endsWith`
- **"contém X"** → `contains`
- **"não contém X"** → `contains` (negado)
- **"pelo menos N X"** → `count` com operador `>=`
- **"exatamente N X"** → `count` com operador `==`
- **"comprimento par"** → `count` de comprimento total com operador `even`
- **"comprimento ímpar"** → `count` de comprimento total com operador `odd`

## Argumentos Disponíveis

| Argumento | Alias | Descrição |
|-----------|-------|-----------|
| `--def` | `-d` | Definição do AFD/MT (formato texto ou caminho para arquivo JSON) |
| `--iterativo-json` | `-ij` | JSON da máquina diretamente (formato igual aos arquivos salvos) |
| `--lang` | `-l` | Descrição da linguagem em português |
| `--test` | `-t` | Strings de teste separadas por vírgula |
| `--name` | `-n` | Nome customizado para salvar arquivo |
| `--verbose` | `-v` | Modo detalhado (mostra execução passo a passo) |
| `--force` | `-f` | Força geração do diagrama mesmo sem regras |
| `--svg` | `-s` | Gera também arquivo SVG (padrão: apenas PDF) |
| `--sugerir` | `-sg`, `--analyze` | Analisa MT e sugere o melhor tipo de implementação |
| `--help` | `-h` | Mostra ajuda |

## Modo Iterativo com JSON

O parâmetro `--iterativo-json` permite passar a definição completa da máquina como JSON diretamente na linha de comando, sem precisar criar um arquivo. O JSON deve estar no mesmo formato dos arquivos salvos pelo sistema.

### Exemplo 1: Máquina de Turing para Linguagem {a^n b^n}

```bash
node cli.js --iterativo-json '{
  "Estados": ["q0", "q1", "q2", "qf", "qreject"],
  "Alfabeto_Entrada": ["a", "b"],
  "Alfabeto_Fita": ["a", "b", "X", "Y", "_"],
  "Simbolo_Branco": "_",
  "Estado_Inicial": "q0",
  "Estado_Aceitacao": "qf",
  "Estado_Rejeicao": "qreject",
  "Transicoes": [
    ["q0", "_", "qf", "_", "R"],
    ["q0", "a", "q1", "X", "R"],
    ["q0", "Y", "q0", "Y", "R"],
    ["q1", "a", "q1", "a", "R"],
    ["q1", "b", "q2", "Y", "L"],
    ["q1", "Y", "q1", "Y", "R"],
    ["q2", "a", "q2", "a", "L"],
    ["q2", "X", "q0", "X", "R"],
    ["q2", "Y", "q2", "Y", "L"]
  ]
}' --lang "a^n b^n" --test ",ab,aabb,aaabbb,a,b,aa,bb,aaab"
```

### Exemplo 2: MT para Mesma Quantidade de 'a' e 'b'

```bash
node cli.js --iterativo-json '{
  "Estados": ["q0", "q_busca_a", "q_busca_b", "q_volta", "qf", "qreject"],
  "Alfabeto_Entrada": ["a", "b"],
  "Alfabeto_Fita": ["a", "b", "X", "Y", "_"],
  "Simbolo_Branco": "_",
  "Estado_Inicial": "q0",
  "Estado_Aceitacao": "qf",
  "Estado_Rejeicao": "qreject",
  "Transicoes": [
    ["q0", "_", "qf", "_", "R"],
    ["q0", "a", "q_busca_b", "X", "R"],
    ["q0", "b", "q_busca_a", "Y", "R"],
    ["q0", "X", "q0", "X", "R"],
    ["q0", "Y", "q0", "Y", "R"],
    ["q_busca_a", "a", "q_volta", "X", "L"],
    ["q_busca_a", "b", "q_busca_a", "b", "R"],
    ["q_busca_a", "X", "q_busca_a", "X", "R"],
    ["q_busca_a", "Y", "q_busca_a", "Y", "R"],
    ["q_busca_a", "_", "qreject", "_", "L"],
    ["q_busca_b", "b", "q_volta", "Y", "L"],
    ["q_busca_b", "a", "q_busca_b", "a", "R"],
    ["q_busca_b", "X", "q_busca_b", "X", "R"],
    ["q_busca_b", "Y", "q_busca_b", "Y", "R"],
    ["q_busca_b", "_", "qreject", "_", "L"],
    ["q_volta", "a", "q_volta", "a", "L"],
    ["q_volta", "b", "q_volta", "b", "L"],
    ["q_volta", "X", "q_volta", "X", "L"],
    ["q_volta", "Y", "q_volta", "Y", "L"],
    ["q_volta", "_", "q0", "_", "R"]
  ]
}' --lang "mesma quantidade de a e b" --test ",ab,ba,aabb,abab,a,aa,aaa"
```

### Exemplo 3: Com Modo Verbose

```bash
node cli.js --iterativo-json '{"Estados":["q0","qf","qreject"],...}' --test "ab" --verbose
```

O modo `--verbose` mostra cada passo da execução:
- Estado atual
- Conteúdo da fita com posição do cabeçote
- Símbolo sendo lido
- Transição aplicada

### Exemplo 4: Salvando com Nome Customizado

```bash
node cli.js --iterativo-json '{...}' --lang "palindromos pares" --name "MT_palindromos" --test "aa,abba,aabbaa"
```

Isso salvará como `MT_palindromos.json` e `MT_palindromos.svg`.

## Usando Arquivos JSON

## Dicas

1. **Use aspas simples** para JSON no PowerShell/CMD: `'{"Estados":[...]}'`
2. **Escape aspas duplas** dentro do JSON se usar aspas duplas externas
3. **Separe testes** com vírgulas sem espaços: `aa,ab,ba`
4. **String vazia** nos testes: use vírgula no início: `,ab,ba`
5. **Combine --lang e --test** para validação completa
6. **Use --verbose** para debugar execuções inesperadas
7. **Use --name** para organizar seus arquivos salvos
8. **JSON pode ser minificado** (sem quebras de linha) para facilitar uso no terminal

## Exemplos de Exercícios Completos

### Exercício 1.b: {a^n b^n | n ≥ 0}

```bash
node cli.js --iterativo-json '{
  "Estados": ["q0", "q1", "q2", "qf", "qreject"],
  "Alfabeto_Entrada": ["a", "b"],
  "Alfabeto_Fita": ["a", "b", "X", "Y", "_"],
  "Simbolo_Branco": "_",
  "Estado_Inicial": "q0",
  "Estado_Aceitacao": "qf",
  "Estado_Rejeicao": "qreject",
  "Transicoes": [
    ["q0", "_", "qf", "_", "R"],
    ["q0", "a", "q1", "X", "R"],
    ["q0", "Y", "q0", "Y", "R"],
    ["q1", "a", "q1", "a", "R"],
    ["q1", "b", "q2", "Y", "L"],
    ["q1", "Y", "q1", "Y", "R"],
    ["q2", "a", "q2", "a", "L"],
    ["q2", "X", "q0", "X", "R"],
    ["q2", "Y", "q2", "Y", "L"]
  ]
}' --lang "a^n b^n" --name "MT_exe1_b" --test ",ab,aabb,aaabbb,a,aa,b,bb,aaab,aabbb"
```

### Exercício 1.c: {a^n b^n c^n | n ≥ 0}

```bash
node cli.js --iterativo-json '{
  "Estados": ["q0", "q1", "q2", "q3", "q4", "qf", "qreject"],
  "Alfabeto_Entrada": ["a", "b", "c"],
  "Alfabeto_Fita": ["a", "b", "c", "X", "Y", "Z", "_"],
  "Simbolo_Branco": "_",
  "Estado_Inicial": "q0",
  "Estado_Aceitacao": "qf",
  "Estado_Rejeicao": "qreject",
  "Transicoes": [
    ["q0", "_", "qf", "_", "R"],
    ["q0", "a", "q1", "X", "R"],
    ["q0", "Y", "q0", "Y", "R"],
    ["q0", "Z", "q0", "Z", "R"],
    ["q1", "a", "q1", "a", "R"],
    ["q1", "Y", "q1", "Y", "R"],
    ["q1", "b", "q2", "Y", "R"],
    ["q2", "b", "q2", "b", "R"],
    ["q2", "Z", "q2", "Z", "R"],
    ["q2", "c", "q3", "Z", "L"],
    ["q3", "Z", "q3", "Z", "L"],
    ["q3", "b", "q3", "b", "L"],
    ["q3", "Y", "q3", "Y", "L"],
    ["q3", "a", "q3", "a", "L"],
    ["q3", "X", "q0", "X", "R"]
  ]
}' --lang "a^n b^n c^n" --name "MT_exe1_c" --test ",abc,aabbcc,aaabbbccc,a,ab,aab,aabc,aabbc"
```

### Exercício 1.e: Mesma Quantidade de 'a' e 'b'

```bash
node cli.js --iterativo-json '{
  "Estados": ["q0", "q_busca_a", "q_busca_b", "q_volta", "qf", "qreject"],
  "Alfabeto_Entrada": ["a", "b"],
  "Alfabeto_Fita": ["a", "b", "X", "Y", "_"],
  "Simbolo_Branco": "_",
  "Estado_Inicial": "q0",
  "Estado_Aceitacao": "qf",
  "Estado_Rejeicao": "qreject",
  "Transicoes": [
    ["q0", "_", "qf", "_", "R"],
    ["q0", "a", "q_busca_b", "X", "R"],
    ["q0", "b", "q_busca_a", "Y", "R"],
    ["q0", "X", "q0", "X", "R"],
    ["q0", "Y", "q0", "Y", "R"],
    ["q_busca_a", "a", "q_volta", "X", "L"],
    ["q_busca_a", "b", "q_busca_a", "b", "R"],
    ["q_busca_a", "X", "q_busca_a", "X", "R"],
    ["q_busca_a", "Y", "q_busca_a", "Y", "R"],
    ["q_busca_a", "_", "qreject", "_", "L"],
    ["q_busca_b", "b", "q_volta", "Y", "L"],
    ["q_busca_b", "a", "q_busca_b", "a", "R"],
    ["q_busca_b", "X", "q_busca_b", "X", "R"],
    ["q_busca_b", "Y", "q_busca_b", "Y", "R"],
    ["q_busca_b", "_", "qreject", "_", "L"],
    ["q_volta", "a", "q_volta", "a", "L"],
    ["q_volta", "b", "q_volta", "b", "L"],
    ["q_volta", "X", "q_volta", "X", "L"],
    ["q_volta", "Y", "q_volta", "Y", "L"],
    ["q_volta", "_", "q0", "_", "R"]
  ]
}' --lang "mesma quantidade de a e b" --name "MT_exe1_e" --test ",ab,ba,aabb,abab,abba,baab,aaabbb,a,aa,aaa,b,bb"
```

## Troubleshooting

### Erro: "Cabeçote moveu para posição negativa"
**Causa:** A MT está tentando mover para esquerda da posição 0.
**Solução:** Adicione um marcador de início (#) ou modifique a lógica para não voltar além do início.

### Erro: "Nenhuma transição encontrada"
**Causa:** Falta uma transição para o estado e símbolo atual.
**Solução:** Verifique se todas as transições necessárias estão definidas. Use `--verbose` para ver onde parou.

### Validação Falha mas Testes Manuais Passam
**Causa:** A descrição da linguagem pode não estar sendo interpretada corretamente.
**Solução:** Verifique se a descrição usa os padrões reconhecidos ou defina regras customizadas no JSON.

### JSON Inválido
**Causa:** Sintaxe JSON incorreta.
**Solução:** Valide o JSON em um validador online antes de usar. Certifique-se de usar vírgulas corretamente e fechar todos os colchetes/chaves.

## Formato da Definição

### AFD
```
Estados: q0, q1, q2
Alfabeto: a, b
Estado_Inicial: q0
Estados_Finais: q1, q2
Transicoes:
q0, a, q1
q1, b, q2
```

### AFN (Autômato Finito Não-Determinístico)
```
Estados: q0, q1, q2
Alfabeto: a, b
Estado_Inicial: q0
Estados_Finais: q2
Transicoes:
q0, a, q0
q0, a, q1
q0, ε, q1
q1, b, q2
```

### AP (Autômato de Pilha)
```
Estados: q0, q1, qf
Alfabeto_Entrada: a, b
Alfabeto_Pilha: A, Z
Simbolo_Inicial_Pilha: Z
Estado_Inicial: q0
Estados_Finais: qf
Modo_Aceitacao: estado
Transicoes:
q0, a, Z, q0, AZ
q0, a, A, q0, AA
q0, b, A, q1, ε
q0, ε, Z, qf, Z
q1, b, A, q1, ε
q1, ε, Z, qf, Z
```

**Formato das transições AP:** `estado_atual, símbolo_entrada, topo_pilha, novo_estado, operação_pilha`
- `ε` na entrada = transição sem consumir símbolo
- `ε` na operação de pilha = desempilhar (não empilha nada)
- Símbolos na operação de pilha são empilhados da direita para esquerda (primeiro símbolo fica no topo)

**Modos de aceitação:**
- `estado` - Aceita se terminar em estado final (padrão)
- `pilha` - Aceita se pilha estiver vazia
- `ambos` - Aceita se estado final E pilha vazia

### Máquina de Turing
```
Estados: q0, q1, qaccept, qreject
Alfabeto_Entrada: a, b
Alfabeto_Fita: a, b, _
Simbolo_Branco: _
Estado_Inicial: q0
Estado_Aceitacao: qaccept
Estado_Rejeicao: qreject
Transicoes:
q0, a, q1, a, R
q1, b, qaccept, b, N
```

---

## Exemplos de Autômatos de Pilha (AP)

### AP para L = {a^n b^n | n ≥ 0}

**Linguagem:** Strings com igual número de 'a's seguidos de 'b's

```bash
node cli.js -d inputAP\AP_anbn_igual.json
```

**Arquivo JSON:**
```json
{
    "description": "L = {a^n b^n | n >= 0}",
    "type": "ap",
    "definition": "Estados: q0, q1, qf\nAlfabeto_Entrada: a, b\nAlfabeto_Pilha: A, Z\nSimbolo_Inicial_Pilha: Z\nEstado_Inicial: q0\nEstados_Finais: qf\nModo_Aceitacao: estado\nTransicoes:\nq0, a, Z, q0, AZ\nq0, a, A, q0, AA\nq0, b, A, q1, ε\nq0, ε, Z, qf, Z\nq1, b, A, q1, ε\nq1, ε, Z, qf, Z",
    "rules": [
        {
            "rules": [
                {
                    "type": "matchingPowers",
                    "pattern": "ab",
                    "condition": "i === j"
                }
            ]
        }
    ],
    "testStrings": ["", "ab", "aabb", "aaabbb", "a", "b", "aab", "abb", "ba"]
}
```

### AP para L = {a^i b^j | i > j}

**Linguagem:** Strings com mais 'a's que 'b's

```bash
node cli.js -d inputAP\AP_exe2b_anbn_imaiorj.json
```

**Regras no JSON:**
```json
"rules": [
    {
        "rules": [
            {
                "type": "matchingPowers",
                "pattern": "ab",
                "condition": "i > j"
            }
        ]
    }
]
```

### AP para L = {wcw^R | w ∈ {a,b}*}

**Linguagem:** Palíndromos com marcador central 'c'

```bash
node cli.js -d inputAP\AP_exe2e_wcw_reverse.json
```

**Regras no JSON:**
```json
"rules": [
    {
        "rules": [
            {
                "type": "wcwReverse",
                "separator": "c",
                "alphabet": ["a", "b"]
            }
        ]
    }
]
```

### AP para Parênteses Balanceados

**Linguagem:** Linguagem de Dyck - strings com parênteses bem formados

```bash
node cli.js -d inputAP\AP_exe6d_parenteses.json
```

**Regras no JSON:**
```json
"rules": [
    {
        "rules": [
            {
                "type": "balancedParentheses",
                "pairs": [["(", ")"]]
            }
        ]
    }
]
```

### AP para Parênteses e Colchetes Balanceados

**Linguagem:** Múltiplos tipos de delimitadores balanceados

```bash
node cli.js -d inputAP\AP_exe6e_parenteses_colchetes.json
```

**Regras no JSON:**
```json
"rules": [
    {
        "rules": [
            {
                "type": "balancedParentheses",
                "pairs": [["(", ")"], ["[", "]"]]
            }
        ]
    }
]
```

### Validadores AP Disponíveis

| Tipo | Descrição | Parâmetros |
|------|-----------|------------|
| `matchingPowers` | a^i b^j com condição | `pattern`, `condition` (ex: "i > j", "i === j") |
| `wcwReverse` | wcw^R | `separator`, `alphabet` |
| `balancedParentheses` | Delimitadores balanceados | `pairs` (array de pares) |
| `emptyLanguage` | L = {} | - |
| `emptyStringOnly` | L = {λ} | - |
| `palindrome` | Palíndromos | `palindromeType` ("any", "evenLength", "oddLength") |

---

## Modo Interativo

Se nenhum argumento for passado, o programa entra em modo interativo:

```bash
node cli.js
```

Isso mostrará os arquivos disponíveis na pasta `input` para seleção.

---

## Sugestão de Tipo de Máquina de Turing

O CLI oferece uma funcionalidade de análise que sugere o melhor tipo de Máquina de Turing para implementar uma determinada linguagem. Use as flags `--sugerir`, `-sg` ou `--analyze`.

### Sintaxe

```bash
node cli.js -d <arquivo.json> --sugerir
node cli.js -d <arquivo.json> --sugerir -l "<descrição da linguagem>"
```

### Tipos de MT Analisados

| Tipo | Descrição |
|------|-----------|
| **MT Padrão** | Modelo base com fita infinita à direita |
| **MT Fita Bidirecional** | Fita infinita para ambos os lados |
| **MT Cabeça Imóvel** | A fita move, não a cabeça |
| **MT Múltiplas Trilhas** | Uma fita com múltiplas trilhas paralelas |
| **MT Multifita** | Múltiplas fitas independentes com cabeças próprias |

### Exemplos

#### Exemplo 1: Linguagem Simples (Padrão recomendado)

```bash
node cli.js -d MT_exe1_a.json --sugerir
```

**Saída:**
```
📋 Linguagem: L = {w ∈ {a,b,c}* | w começa com 'ab'}

🔍 Características detectadas:
   • Verificação de padrão simples

📊 RANKING DE TIPOS DE MT:
🥇 100 pts │ MT Padrão
         │   ↳ Linguagem simples - MT padrão é suficiente

✅ RECOMENDAÇÃO: MT Padrão
```

#### Exemplo 2: Linguagem com Contadores (Multifita recomendada)

```bash
node cli.js -d MT_exe3_b.json --sugerir
```

**Saída:**
```
📋 Linguagem: L = {a^n b^n c^n | n ≥ 0}

🔍 Características detectadas:
   • Condição composta (OR/AND)
   • Múltiplos contadores (i, j, k)
   • Requer comparação de quantidades

📊 RANKING DE TIPOS DE MT:
🥇 125 pts │ MT Multifita
         │   ↳ IDEAL: Cada contador pode usar uma fita separada

🥈  85 pts │ MT com Múltiplas Trilhas
         │   ↳ Útil para comparar quantidades em paralelo

✅ RECOMENDAÇÃO: MT Multifita
   • Reduz complexidade de O(n²) para O(n)
```

#### Exemplo 3: Palíndromos (Multifita ou Bidirecional)

```bash
node cli.js -d MT_exe1_d.json --sugerir -l "ww^R palindromes"
```

**Saída:**
```
📋 Linguagem: ww^R palindromes

🔍 Características detectadas:
   • Palíndromo (requer reversão)
   • Requer comparação com reverso (ww^R ou similar)

📊 RANKING DE TIPOS DE MT:
🥇  70 pts │ MT Multifita
         │   ↳ IDEAL: Pode copiar para segunda fita e comparar em direções opostas

🥈  65 pts │ MT com Fita Bidirecional
         │   ↳ Facilita operações de reversão

✅ RECOMENDAÇÃO: MT Multifita
   (também considere: MT com Fita Bidirecional)
```

#### Exemplo 4: Linguagem n = 2m (Múltiplas Trilhas)

```bash
node cli.js -d MT_exe3_c.json --sugerir
```

**Saída:**
```
📋 Linguagem: L = {a^n b^m | n = 2m}

🔍 Características detectadas:
   • Comparação de quantidades (n = 2m)
   • Condição múltipla/razão

📊 RANKING DE TIPOS DE MT:
🥇 105 pts │ MT Multifita

🥈  75 pts │ MT com Múltiplas Trilhas
         │   ↳ Pode usar trilhas para comparar contagens

✅ RECOMENDAÇÃO: MT Multifita
```

### Características Detectadas Automaticamente

A ferramenta detecta as seguintes características a partir das regras e descrição:

| Característica | Padrões Reconhecidos |
|---------------|---------------------|
| **Linguagem estruturada** | `a^n b^n`, `anbn`, `i === j` |
| **Múltiplos contadores** | `a^n b^n c^n`, `i, j, k` |
| **Palíndromo/Reversão** | `ww^R`, `palindrom`, `reverso` |
| **Comparação de quantidades** | `mesma quantidade`, `igual`, `n = 2m` |
| **Padrão simples** | `começa com`, `termina com`, `contém` |

### Tabela de Complexidade

A análise também mostra uma tabela comparativa de complexidade típica:

```
📈 Comparação de Complexidade Típica:
───────────────────────────────────────────────────────
   Tipo de MT                    │ Complexidade Típica
───────────────────────────────────────────────────────
   MT Padrão                     │ O(n²) a O(n³)
   MT Fita Bidirecional          │ O(n²) a O(n³)
   MT Cabeça Imóvel              │ O(n²) a O(n³)
   MT Múltiplas Trilhas          │ O(n) a O(n²)
   MT Multifita                  │ O(n) a O(n log n)
───────────────────────────────────────────────────────
```

### Quando Usar Cada Tipo

| Tipo de MT | Melhor Para |
|------------|-------------|
| **MT Padrão** | Linguagens simples, verificações de padrão |
| **MT Fita Bidirecional** | Operações de reversão, escrita à esquerda do início |
| **MT Cabeça Imóvel** | Leitura sequencial simples |
| **MT Múltiplas Trilhas** | Comparar informações em paralelo na mesma posição |
| **MT Multifita** | Contadores independentes, copiar e comparar, operações O(n) |
