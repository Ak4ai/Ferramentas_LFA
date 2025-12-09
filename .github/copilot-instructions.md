# GitHub Copilot - Instruções de Contexto
## Projeto: Ferramentas LFA (Linguagens Formais e Autômatos)

### Visão Geral do Projeto
Este projeto fornece ferramentas CLI em Node.js para validação, simulação e geração de diagramas para:
- **AFD** (Autômatos Finitos Determinísticos)
- **AFN** (Autômatos Finitos Não-Determinísticos)
- **AP** (Autômatos de Pilha / PDA)
- **MT** (Máquinas de Turing)
- **MTND** (Máquinas de Turing Não-Determinísticas)
- **MT Multifita** (Máquinas de Turing com múltiplas fitas)
- **GR** (Gramáticas Regulares)

### Estrutura de Diretórios
```
Ferramentas_LFA/
├── cli.js                    # CLI principal
├── inputAFD/                 # Definições JSON de AFDs
├── inputAFN/                 # Definições JSON de AFNs
├── inputAP/                  # Definições JSON de APs
├── inputMT/                  # Definições JSON de MTs
├── inputMT_ND/               # Definições JSON de MTNDs
├── inputGR/                  # Definições de Gramáticas
├── diagramasAFD/             # PDFs gerados (AFD)
├── diagramasAFN/             # PDFs gerados (AFN)
├── diagramasAP/              # PDFs gerados (AP)
├── diagramasMT/              # PDFs gerados (MT)
├── pdfs_respostas/           # LaTeX e PDFs de exercícios
└── EXEMPLOS_CLI.md           # Documentação de uso
```

---

## 🔧 FERRAMENTAS CLI DISPONÍVEIS

### 1. Comandos Básicos do CLI

#### Listar arquivos disponíveis
```bash
node cli.js --list          # Lista todos os tipos
node cli.js --list afd      # Lista apenas AFDs
node cli.js --list mt       # Lista apenas MTs
```

#### Processar arquivo (gerar diagrama e validar)
```bash
node cli.js --file inputMT/MT_exe1_a.json
node cli.js --def inputMT_ND/MTND_exe4_d.json
```

#### Testar com strings específicas
```bash
node cli.js --def inputMT/MT_exe1_a.json --test "ab,abc,ba,a,b"
node cli.js --def inputMT/MT_exe1_a.json --input "ab"
```

#### Modo verbose (mostra execução detalhada)
```bash
node cli.js --def inputMT/MT_exe1_a.json --input "aa" --verbose
```

---

## 📊 FORMATO JSON PARA MÁQUINAS DE TURING

### Estrutura Básica (MT Padrão)
```json
{
  "description": "MT para L = {a^n b^n | n >= 0}",
  "definition": "Estados: q0, q1, q2, qf, qr\nAlfabeto_Entrada: a, b\nAlfabeto_Fita: a, b, X, Y, _\nSimbolo_Branco: _\nEstado_Inicial: q0\nEstado_Aceitacao: qf\nEstado_Rejeicao: qr\nTransicoes:\nq0, a, q1, X, R\nq1, b, q2, Y, L\n...",
  "rules": [
    {
      "rules": [
        {
          "type": "structuredLanguage",
          "value": {
            "symbols": "ab",
            "condition": "i === j"
          }
        }
      ]
    }
  ]
}
```

### MT Multifita
```json
{
  "description": "MT Multifita para a^n b^n c^n",
  "multitape": true,
  "tapeCount": 3,
  "definition": "Estados: q0, q1, qf, qr\n...\nTransicoes:\nq0, [a, _, _], q0, [a, I, _], [R, R, N]\n..."
}
```

### MT Não-Determinística
```json
{
  "description": "MTND para palíndromos",
  "nondeterministic": true,
  "definition": "Estados: q0, q_scan, qf, qr\n...\nTransicoes:\nq_scan, a, q_scan, a, R\nq_scan, a, q_mark, a, L\n..."
}
```

---

## 🎯 FUNÇÕES PRINCIPAIS DO CLI.JS

### Detecção Automática de Tipo
```javascript
detectMachineType(content, jsonData)
// Retorna: 'AFD', 'AFN', 'AP', 'MT', 'MT_MULTIFITA', 'GR'
```

### Parsers Disponíveis
- `parseAfdDefinition(text)` - AFD
- `parseAfnDefinition(text)` - AFN com epsilon
- `parseApDefinition(text)` - AP/PDA
- `parseTuringDefinition(text)` - MT padrão
- `parseMultitapeDefinition(def)` - MT multifita
- `parseGrammarDefinition(text)` - Gramáticas

### Simuladores

#### MT Padrão (Determinística)
```javascript
simulateTuring(tm, inputString, maxSteps = 2000, verbose = false)
// Retorna: { result: true/false, log: [...], steps, tape, state }
```

#### MT Não-Determinística (BFS)
```javascript
simulateNondeterministicTuring(tm, inputString, maxSteps = 2000, verbose = false)
// Explora TODAS as ramificações usando BFS
// Retorna: { 
//   result: true/false, 
//   log: [...], 
//   acceptingPath: [...],
//   exploredPaths: N,
//   visitedConfigs: N
// }
```

#### MT Multifita
```javascript
simulateMultitapeTuring(mtm, inputString, maxSteps = 2000, verbose = false)
// Simula k fitas simultâneas
// Retorna: { result, log, steps, tapes: [...], state }
```

### Detecção de Não-Determinismo
```javascript
detectNondeterminism(tm)
// Verifica se há múltiplas transições para (estado, símbolo)
// Retorna: boolean
```

### Geradores de Diagramas
```javascript
generateTuringMermaidCode(tm)          // MT padrão
generateMultitapeMermaidCode(mtm)      // MT multifita
generateAfnMermaidCode(afn)            // AFN
generateApMermaidCode(ap)              // AP
generateGrMermaidCode(afn, gramInfo)   // GR (como AFN)
```

---

## 🧪 VALIDADORES DE REGRAS (50+ tipos)

### Validadores Básicos
- `startsWith` - Verifica prefixo
- `endsWith` - Verifica sufixo
- `contains` - Contém substring
- `regex` - Expressão regular
- `acceptAll` - Aceita tudo (Σ*)

### Validadores Estruturais
- `structuredLanguage` - Padrão a^n b^m com condições
  ```json
  { "symbols": "ab", "condition": "i === j" }
  { "symbols": "abc", "condition": "i === j && j === k" }
  ```
- `palindrome` - Palíndromos
  ```json
  { "type": "even" }  // ww^R apenas
  { "type": "any" }   // qualquer palíndromo
  ```
- `equalCount` - Contagens iguais
  ```json
  { "chars": ["a", "b"] }  // #a = #b
  ```

### Validadores de Contagem
- `count` - Contagem avançada
  ```json
  { "subject": {"type": "char", "char": "a"}, "operator": "==", "N": 5 }
  ```
- `parity` - Paridade (par/ímpar)
  ```json
  { "char": "a", "type": "even" }
  ```
- `divisibleBy` - Divisível por N
  ```json
  { "char": "a", "n": 3 }
  ```

### Validadores para AP
- `balancedParentheses` - Parênteses balanceados
  ```json
  { "pairs": [["(", ")"], ["[", "]"]] }
  ```
- `wcwReverse` - Padrão wcw^R
  ```json
  { "separator": "c", "alphabet": ["a", "b"] }
  ```
- `matchingPowers` - Potências correspondentes
  ```json
  { "pattern": "ab", "condition": "i > j" }
  ```

### Validadores Complexos
- `complexCondition` - Expressão JavaScript
  ```json
  { "expression": "(str.endsWith('01') && str.includes('011')) || str.endsWith('10')" }
  ```

---

## 🚀 PADRÕES DE USO COMUNS

### 1. Criar Nova MT e Testar
```bash
# 1. Criar arquivo JSON em inputMT/
# 2. Gerar diagrama e validar
node cli.js --def inputMT/MT_novo.json

# 3. Testar casos específicos
node cli.js --def inputMT/MT_novo.json --test "aa,aba,aaa"

# 4. Debug com verbose
node cli.js --def inputMT/MT_novo.json --input "aa" --verbose
```

### 2. Criar MT Não-Determinística
```bash
# Arquivo JSON deve ter: "nondeterministic": true
# E múltiplas transições: q0,a -> q1,X,R e q0,a -> q2,a,R

# CLI detecta automaticamente e usa BFS
node cli.js --def inputMT_ND/MTND_exe4_d.json --test "aa,abba,aba"
```

### 3. Criar MT Multifita
```bash
# Arquivo JSON deve ter: "multitape": true, "tapeCount": 3
# Transições: q0, [a, _, _], q1, [a, I, _], [R, R, N]

node cli.js --def inputMT/MT_multifita.json --test "aaabbbccc"
```

### 4. Verificar se MT é Não-Determinística
```powershell
# Script PowerShell para verificar não-determinismo
$json = Get-Content inputMT_ND/MTND_exe4_d.json | ConvertFrom-Json
$trans = $json.definition -split "`n" | Where-Object { $_ -match '^q' }
$grouped = $trans | Group-Object { ($_ -split ',')[0..1] -join ',' } | Where-Object { $_.Count -gt 1 }
if ($grouped) { Write-Host "NÃO-DET detectado" }
```

---

## 📝 FORMATO DE TRANSIÇÕES

### MT Padrão
```
estado_atual, simbolo_lido, prox_estado, simbolo_escrito, movimento
q0, a, q1, X, R    # Lê 'a', escreve 'X', move Right
q1, b, q2, b, L    # Lê 'b', mantém 'b', move Left
q2, _, qf, _, N    # Lê branco, para (None)
```

### MT Multifita (k=3)
```
estado, [fita1, fita2, fita3], prox, [esc1, esc2, esc3], [mov1, mov2, mov3]
q0, [a, _, _], q0, [a, I, _], [R, R, N]
# Fita 1: lê 'a', mantém 'a', move R
# Fita 2: lê '_', escreve 'I', move R
# Fita 3: lê '_', mantém '_', não move
```

### MT Não-Determinística
```
# Múltiplas transições para mesmo (estado, símbolo)
q_scan, a, q_scan, a, R    # Opção 1: continua
q_scan, a, q_mark, X, L    # Opção 2: marca (escolha ND!)
```

---

## 🎨 GERAÇÃO DE DIAGRAMAS

### Fluxo Completo
1. **Parse** - Converte string de definição para objeto JS
2. **Validação** - Verifica estrutura (estados, alfabeto, transições)
3. **Mermaid** - Gera código Mermaid stateDiagram-v2
4. **PDF** - `mmdc` converte para PDF (requer @mermaid-js/mermaid-cli)

### Instalação do mmdc
```bash
npm install -g @mermaid-js/mermaid-cli
```

### Saída de Diagramas
- **PDF**: `diagramasMT/MT_exe1_a.pdf`
- **SVG**: `diagramasMT/MT_exe1_a.svg` (se `--svg`)
- **Mermaid**: Código gerado inline no console

---

## 🧠 ALGORITMOS DE SIMULAÇÃO

### MT Determinística
- **Estratégia**: Execução linear passo a passo
- **Complexidade**: O(maxSteps)
- **Parada**: Estado final (qf/qr) ou maxSteps excedido

### MT Não-Determinística (BFS)
- **Estratégia**: Busca em largura explorando TODAS as ramificações
- **Estrutura**: 
  ```javascript
  queue = [{ tape, head, state, steps, path }]
  visited = Set<"estado:posição:fita">
  ```
- **Aceita**: Se QUALQUER caminho leva a qf
- **Rejeita**: Se TODOS os caminhos falham
- **Complexidade**: O(b^d) onde b = branching factor, d = profundidade

### MT Multifita
- **Estratégia**: Simula k fitas em paralelo
- **Vantagem**: Problemas O(n²) viram O(n)
- **Exemplo**: a^n b^n c^n em O(n) com 3 fitas

---

## 🔍 DEBUGGING E TROUBLESHOOTING

### Problema: MT Rejeita Tudo
1. **Verificar alfabeto**: Todos os símbolos usados estão declarados?
2. **Verificar transições**: Há transição para cada (estado, símbolo)?
3. **Usar verbose**: `--verbose` mostra execução passo a passo
4. **Verificar estado final**: String termina em estado de aceitação?

### Problema: MTND não é Não-Determinística
1. **Verificar transições múltiplas**: Mesmo (q, a) deve ter 2+ transições
2. **Script de verificação**:
   ```powershell
   $trans = $json.definition -split "`n" | Where-Object { $_ -match '^q' }
   $trans | Group-Object { ($_ -split ',')[0..1] -join ',' } | Where { $_.Count -gt 1 }
   ```

### Problema: Diagrama não Gera
1. **Verificar mmdc**: `mmdc --version`
2. **Instalar**: `npm install -g @mermaid-js/mermaid-cli`
3. **Puppeteer**: Pode precisar de Chrome/Chromium instalado

### Problema: Regras não Validam
1. **Verificar sintaxe JSON**: Vírgulas, chaves, aspas
2. **Tipo correto**: `structuredLanguage`, `palindrome`, etc.
3. **Condição válida**: Usar `i, j, k` (não `n, m`)

---

## 📚 EXEMPLOS PRÁTICOS

### Exemplo 1: MT para a^n b^n
```json
{
  "description": "MT para L = {a^n b^n | n >= 0}",
  "definition": "Estados: q0, q1, q2, q3, qf, qr\nAlfabeto_Entrada: a, b\nAlfabeto_Fita: a, b, X, Y, _\nSimbolo_Branco: _\nEstado_Inicial: q0\nEstado_Aceitacao: qf\nEstado_Rejeicao: qr\nTransicoes:\nq0, _, qf, _, N\nq0, a, q1, X, R\nq0, Y, q0, Y, R\nq1, a, q1, a, R\nq1, Y, q1, Y, R\nq1, b, q2, Y, L\nq2, a, q2, a, L\nq2, Y, q2, Y, L\nq2, X, q0, X, R",
  "rules": [
    {
      "rules": [
        {
          "type": "structuredLanguage",
          "value": {
            "symbols": "ab",
            "condition": "i === j"
          }
        }
      ]
    }
  ]
}
```

### Exemplo 2: MTND para Palíndromos
```json
{
  "description": "MTND para ww^R (palíndromos pares)",
  "nondeterministic": true,
  "definition": "Estados: q0, q_scan, q_mark_end, q_match_a, q_match_b, q_back, qf, qr\nAlfabeto_Entrada: a, b\nAlfabeto_Fita: a, b, X, Y, _\nSimbolo_Branco: _\nEstado_Inicial: q0\nEstado_Aceitacao: qf\nEstado_Rejeicao: qr\nTransicoes:\nq0, _, qf, _, N\nq0, X, q0, X, R\nq0, Y, q0, Y, R\nq0, a, q_scan, X, R\nq0, b, q_scan, Y, R\nq_scan, a, q_scan, a, R\nq_scan, a, q_mark_end, a, L\nq_scan, b, q_scan, b, R\nq_scan, b, q_mark_end, b, L\nq_scan, _, q_mark_end, _, L\nq_mark_end, a, q_match_a, X, L\nq_mark_end, b, q_match_b, Y, L\nq_mark_end, X, qf, X, N\nq_mark_end, Y, qf, Y, N\nq_match_a, a, q_match_a, a, L\nq_match_a, b, q_match_a, b, L\nq_match_a, X, q_back, X, R\nq_match_a, Y, qr, Y, N\nq_match_b, a, q_match_b, a, L\nq_match_b, b, q_match_b, b, L\nq_match_b, Y, q_back, Y, R\nq_match_b, X, qr, X, N\nq_back, a, q0, X, R\nq_back, b, q0, Y, R",
  "rules": [
    {
      "rules": [
        {
          "type": "palindrome",
          "value": {
            "type": "even"
          }
        }
      ]
    }
  ]
}
```

### Exemplo 3: MT Multifita para a^n b^n c^n
```json
{
  "description": "MT Multifita (3 fitas) para a^n b^n c^n - O(n)",
  "multitape": true,
  "tapeCount": 3,
  "definition": "Estados: q0, q1, q2, qf, qr\nAlfabeto_Entrada: a, b, c\nAlfabeto_Fita: a, b, c, I, _\nSimbolo_Branco: _\nEstado_Inicial: q0\nEstado_Aceitacao: qf\nEstado_Rejeicao: qr\nTransicoes:\nq0, [a, _, _], q0, [a, I, _], [R, R, N]\nq0, [b, I, _], q1, [b, _, I], [R, L, R]\nq1, [b, I, _], q1, [b, _, I], [R, L, R]\nq1, [c, _, I], q2, [c, _, _], [R, N, L]\nq2, [c, _, I], q2, [c, _, _], [R, N, L]\nq2, [_, _, _], qf, [_, _, _], [N, N, N]"
}
```

---

## 💡 DICAS PARA O COPILOT

### Ao Criar Novas MTs
1. **Sempre incluir**:
   - `description` clara
   - `Alfabeto_Entrada` e `Alfabeto_Fita` completos
   - `Simbolo_Branco` (geralmente `_`)
   - Estados `qf` e `qr`
   - Transições para TODOS os casos

2. **Para MTND**:
   - Adicionar `"nondeterministic": true`
   - Criar múltiplas transições para mesmos pares (estado, símbolo)
   - Pensar em "adivinhação" (onde parar, qual parear, etc.)

3. **Para Multifita**:
   - Adicionar `"multitape": true` e `"tapeCount": N`
   - Usar notação `[s1, s2, s3]` para símbolos/movimentos
   - Aproveitar fitas extras como contadores

### Ao Debugar
1. Sempre começar com `--verbose` para ver execução
2. Testar string vazia `""` primeiro
3. Testar casos extremos (1 símbolo, muito longo)
4. Verificar se regras de validação correspondem à linguagem

### Padrões de Complexidade
- **O(n²) → O(n) com Multifita**: Usar fitas extras como contadores
- **O(n²) → O(n) com MTND**: "Adivinhar" posições/escolhas
- **Determinístico já O(n)**: Não precisa ND nem multifita

---

## 🎓 EXERCÍCIOS RESOLVIDOS (Referência)

### Lista MT Padrão (Exercício 1)
- 1.a: Começa com 'ab' - O(1)
- 1.b: a^n b^n c^n - O(n²)
- 1.c: a^(2m) b^m - O(n²)
- 1.d: ww^R (palíndromos) - O(n²)
- 1.e: #a = #b - O(n²)
- 1.f: 1^n 0^(n+3) - O(n²)
- 1.g: a^n b^(2n) c^(n-1) - O(n²)
- 1.h: j = max(i,k) - O(n²)
- 1.i: i=j OU j=k - O(n²)

### Lista MT Multifita (Exercício 3)
- Todas as acima com O(n) usando 2-3 fitas

### Lista MTND (Exercício 4)
- Todas as acima com O(n) usando não-determinismo
- **Chave**: Adivinhar pontos de decisão

---

## 📖 REFERÊNCIAS

- **Arquivo principal**: `cli.js`
- **Documentação**: `EXEMPLOS_CLI.md`
- **LaTeX**: `pdfs_respostas/Lista_MT_Respostas.tex`
- **Listas de exercícios**: `Listas/Lista MTs.txt`

---

## ⚙️ CONFIGURAÇÕES RECOMENDADAS

Ao usar este contexto, o Copilot deve:
1. ✅ Sugerir código compatível com Node.js (CommonJS, não ES6 modules)
2. ✅ Usar funções já existentes em `cli.js` antes de criar novas
3. ✅ Seguir formato JSON estabelecido para definições
4. ✅ Incluir validação de entrada (alfabeto, estados, transições)
5. ✅ Priorizar clareza e manutenibilidade sobre brevidade
6. ✅ Adicionar logs informativos para debugging
7. ✅ Considerar casos extremos (string vazia, muito longa, símbolos inválidos)
8. ✅ Documentar complexidade de tempo/espaço em comentários

---

## ⚠️ REGRAS CRÍTICAS DE RESOLUÇÃO

### 1. NÃO USE NÃO-DETERMINISMO POR PADRÃO
**IMPORTANTE**: Sempre resolva problemas usando **MT Padrão (Determinística)** a menos que:
- O usuário **explicitamente** solicite MTND
- O usuário mencione "não-determinística" ou "não-determinismo"
- O problema exija O(n) e não seja viável com Multifita

**Justificativa**: MTs determinísticas são:
- Mais fáceis de entender e debugar
- Mais previsíveis na execução
- Suficientes para a maioria dos problemas

**Exemplo de solicitação explícita**:
- ✅ "Crie uma MTND para palíndromos"
- ✅ "Use não-determinismo para resolver..."
- ✅ "Quero uma solução não-determinística"
- ❌ "Crie uma MT para palíndromos" → Use MT Padrão!

### 2. SEMPRE INFORME O MÉTODO USADO
Ao criar qualquer solução, **declare explicitamente** qual método está usando:

**Template de resposta**:
```
📋 MÉTODO DE RESOLUÇÃO: [MT Padrão / MT Multifita / MTND]
📊 COMPLEXIDADE: O(?)
🎯 JUSTIFICATIVA: [Por que este método foi escolhido]

[... resto da solução ...]
```

**Exemplo**:
```
📋 MÉTODO DE RESOLUÇÃO: MT Padrão (Determinística)
📊 COMPLEXIDADE: O(n²)
🎯 JUSTIFICATIVA: Problema clássico de pareamento a^n b^n, não requer otimização para O(n)
```

### 3. SEMPRE ADICIONE REGRAS DE VALIDAÇÃO
**OBRIGATÓRIO**: Todo arquivo JSON deve ter a seção `rules` preenchida com validadores apropriados.

**Fluxo de trabalho**:
1. Analise a linguagem L
2. Identifique qual validador usar (veja lista de 50+ validadores)
3. Se o validador EXISTIR → adicione ao JSON
4. Se o validador NÃO EXISTIR:
   - **Pergunte ao usuário**: "A regra `[nome_regra]` não existe. Deseja que eu adicione suporte no código?"
   - Se usuário disser **SIM** → Implemente o validador em `cli.js`
   - Se usuário disser **NÃO** → Prossiga sem regra, gere apenas o diagrama

**Exemplo de validadores comuns**:
```json
// Para a^n b^n
"rules": [{
  "rules": [{
    "type": "structuredLanguage",
    "value": { "symbols": "ab", "condition": "i === j" }
  }]
}]

// Para palíndromos
"rules": [{
  "rules": [{
    "type": "palindrome",
    "value": { "type": "even" }
  }]
}]

// Para #a = #b
"rules": [{
  "rules": [{
    "type": "equalCount",
    "value": { "chars": ["a", "b"] }
  }]
}]
```

**Se validador não existe**:
```
⚠️ ATENÇÃO: A regra necessária para validar esta linguagem não existe no sistema.

Validador sugerido: `customPatternMatch`
Descrição: Verifica padrão [descrever padrão]

Deseja que eu:
1. Adicione suporte para este validador no cli.js?
2. Prossiga sem validação (apenas diagrama)?

Responda: 1 ou 2
```

### 4. DETECÇÃO DE BUGS NO CLI

**SINTOMAS DE BUG**:
Se após múltiplas correções a MT:
- ✅ Lógica está correta (verificado manualmente)
- ✅ Transições cobrem todos os casos
- ✅ Alfabeto está completo
- ❌ **MAS**: Continua rejeitando strings que deveria aceitar

**DIAGNÓSTICO**:
```bash
# 1. Teste com verbose para ver execução detalhada
node cli.js --def inputMT/MT_problema.json --input "caso_simples" --verbose

# 2. Verifique se o simulador está:
#    - Parando prematuramente
#    - Não explorando todas as transições
#    - Detectando incorretamente o tipo de MT
```

**POSSÍVEIS BUGS NO CLI**:
1. **Simulador não-determinístico não ativado**:
   - Bug: `detectNondeterminism()` não detecta múltiplas transições
   - Solução: Verificar se há transições duplicadas no parse

2. **Alfabeto incompatível**:
   - Bug: Parser não reconhece todos os símbolos
   - Solução: Verificar `Alfabeto_Fita` vs símbolos usados

3. **Estado final não reconhecido**:
   - Bug: `Estado_Aceitacao` vs `qf` vs `finalStates`
   - Solução: Padronizar nomes de estados finais

4. **Transições não parseadas corretamente**:
   - Bug: Formato de transição não bate com parser
   - Solução: Verificar formato exato esperado

**AÇÃO DO COPILOT**:
Se detectar loop de correções (3+ iterações sem sucesso):
```
⚠️ POSSÍVEL BUG NO CLI DETECTADO

Sintomas:
- [Listar sintomas observados]
- Tentativas de correção: [N]
- Problema persiste após correções lógicas

Diagnóstico sugerido:
1. [Possível causa 1]
2. [Possível causa 2]

Ações recomendadas:
- Testar com MT similar conhecida que funciona
- Comparar formato JSON com exemplos funcionais
- Verificar logs do simulador em modo verbose

Deseja que eu:
1. Investigue o bug no cli.js?
2. Tente abordagem alternativa (outro tipo de MT)?
```

### 5. PRIORIDADE: DIAGRAMA SEMPRE GERADO

**REGRA DE OURO**: Mesmo que validação/regras falhem, **SEMPRE** gere o diagrama.

**Ordem de prioridade**:
1. **CRÍTICO**: Diagrama PDF gerado (`diagramasMT/*.pdf`)
2. **IMPORTANTE**: Definição da MT correta (transições funcionam)
3. **DESEJÁVEL**: Regras de validação implementadas
4. **OPCIONAL**: Otimizações de performance

**Se encontrar bloqueios**:
- ❌ Regra não existe → Ofereça implementar, mas **prossiga sem ela**
- ❌ Validação falha → Gere diagrama mesmo assim
- ❌ CLI tem bug → Documente problema, mas **gere diagrama**
- ✅ **NUNCA** deixe de gerar diagrama por falta de validador

**Mensagem ao gerar sem validação**:
```
⚠️ Diagrama gerado sem validação automática

Arquivo: diagramasMT/MT_[nome].pdf ✅
Definição: inputMT/MT_[nome].json ✅
Validação: ❌ (validador não disponível)

Para validar manualmente, teste com:
node cli.js --def inputMT/MT_[nome].json --test "caso1,caso2,caso3"
```

---

## 🎯 WORKFLOW DE RESOLUÇÃO DE PROBLEMAS COM MT

### PASSO 1: ANÁLISE DO PROBLEMA
Quando receber uma descrição de linguagem, analise:

1. **Identifique o tipo de linguagem**:
   - Linguagem regular? → AFD/AFN
   - Linguagem livre de contexto? → AP
   - Linguagem recursivamente enumerável? → MT

2. **Analise a estrutura da linguagem**:
   ```
   Exemplos de padrões:
   - a^n b^n           → MT O(n²) ou AP
   - a^n b^n c^n       → MT O(n²), Multifita O(n), MTND O(n)
   - ww^R              → MT O(n²) ou MTND O(n)
   - #a = #b           → MT O(n²) ou MTND O(n)
   - Começa com 'ab'   → MT O(1) trivial
   ```

3. **Determine a complexidade desejada**:
   - **MT Padrão**: Aceitável para O(n²), implementação direta
   - **MT Multifita**: Use se quer O(n) e pode usar múltiplas fitas como contadores
   - **MTND**: Use se quer O(n) e pode "adivinhar" posições/escolhas

### PASSO 2: ESCOLHA DO MODELO DE MT

#### Quando usar MT Padrão (Determinística)
- ✅ Linguagens simples (verificações O(1) ou O(n))
- ✅ Primeira tentativa de resolução
- ✅ Quando não há requisito de complexidade O(n)
- ✅ Exemplos: começa com 'ab', a^n b^n, #a = #b

**Vantagens**: Simples, fácil debug
**Desvantagens**: Geralmente O(n²) para problemas de contagem

#### Quando usar MT Multifita
- ✅ Problemas com múltiplas contagens independentes
- ✅ Precisa reduzir O(n²) para O(n)
- ✅ Pode usar fitas como contadores/buffers
- ✅ Exemplos: a^n b^n c^n, a^n b^(2n) c^(n-1)

**Vantagens**: O(n) em muitos casos, paralelização de contagens
**Desvantagens**: Mais complexo implementar e debugar

#### Quando usar MTND
- ✅ Precisa "adivinhar" posições (meio de palíndromo)
- ✅ Precisa "adivinhar" pareamentos (qual a com qual b)
- ✅ Precisa "adivinhar" qual condição testar (i=j OU j=k)
- ✅ Exemplos: palíndromos, i=j ou j=k, #a=#b

**Vantagens**: O(n) usando não-determinismo, elegante
**Desvantagens**: Mais difícil pensar, BFS explora múltiplos caminhos

### PASSO 3: DESIGN DO ALGORITMO

#### Template para MT Padrão (a^n b^n)
```
1. Marca um 'a' com X, vai para direita
2. Busca um 'b', marca com Y, volta para esquerda
3. Volta ao início (primeiro X)
4. Repete até não sobrar a's nem b's
5. Aceita se fita só tem X's e Y's
```

#### Template para MT Multifita (a^n b^n c^n)
```
Fita 1: Entrada original
Fita 2: Contador de a's (escreve I para cada a)
Fita 3: Contador de b's (escreve I para cada b)

Passo 1: Percorre a's, escreve I na fita 2
Passo 2: Percorre b's, apaga I da fita 2, escreve I na fita 3
Passo 3: Percorre c's, apaga I da fita 3
Passo 4: Aceita se fita 2 e 3 estão vazias
```

#### Template para MTND (palíndromos ww^R)
```
1. Marca primeiro símbolo com X/Y
2. Avança pela fita
3. **NÃO-DETERMINISTICAMENTE** escolhe:
   - Continuar avançando
   - Parar aqui (adivinhar que é o meio)
4. Marca último símbolo, verifica se corresponde ao primeiro
5. Volta e repete
```

### PASSO 4: CRIAÇÃO DO ARQUIVO JSON

Use este template base:

```json
{
  "description": "MT para L = {DESCREVER LINGUAGEM}",
  "definition": "Estados: q0, q1, q2, qf, qr\nAlfabeto_Entrada: a, b\nAlfabeto_Fita: a, b, X, Y, _\nSimbolo_Branco: _\nEstado_Inicial: q0\nEstado_Aceitacao: qf\nEstado_Rejeicao: qr\nTransicoes:\n[TRANSIÇÕES AQUI]",
  "rules": [
    {
      "rules": [
        {
          "type": "structuredLanguage",
          "value": {
            "symbols": "ab",
            "condition": "i === j"
          }
        }
      ]
    }
  ]
}
```

**Checklist antes de salvar**:
- [ ] Todos os símbolos usados estão em `Alfabeto_Fita`?
- [ ] Há transição para cada (estado, símbolo) relevante?
- [ ] Estado inicial definido?
- [ ] Estados de aceitação/rejeição definidos?
- [ ] Símbolo branco definido (`_` padrão)?
- [ ] Rules correspondem à linguagem descrita?

### PASSO 5: TESTE INICIAL

```bash
# 1. Gerar diagrama e validar estrutura
node cli.js --def inputMT/MT_novo.json

# 2. Verificar se passou validação básica
# Se erros: corrigir alfabeto, estados, transições
```

### PASSO 6: TESTES COM CASOS SIMPLES

```bash
# 3. Testar string vazia (geralmente aceita ou rejeita trivialmente)
node cli.js --def inputMT/MT_novo.json --input ""

# 4. Testar caso trivial mais simples (1 símbolo ou mínimo)
node cli.js --def inputMT/MT_novo.json --input "ab"

# 5. Testar caso válido médio
node cli.js --def inputMT/MT_novo.json --input "aabb"
```

**Se falhar**: Use `--verbose` para debug detalhado

### PASSO 7: DEBUG COM VERBOSE

```bash
# Ver execução passo a passo
node cli.js --def inputMT/MT_novo.json --input "aabb" --verbose
```

**Analise no log**:
- ✅ Fita está sendo modificada corretamente?
- ✅ Cabeçote move para posições corretas?
- ✅ Estados de transição fazem sentido?
- ✅ Chegou em estado final correto (qf ou qr)?

**Problemas comuns**:
1. **Loop infinito**: Transição circular sem progresso → Verificar movimento
2. **Rejeita muito cedo**: Falta transição → Adicionar caso faltante
3. **Aceita incorretamente**: Lógica de verificação falha → Revisar algoritmo
4. **Símbolos incorretos**: Fita tem símbolos não declarados → Atualizar alfabeto

### PASSO 8: TESTES ABRANGENTES

```bash
# Teste batch com múltiplos casos
node cli.js --def inputMT/MT_novo.json --test "ab,aabb,aaabbb,aaaabbbb"

# Teste casos que DEVEM REJEITAR
node cli.js --def inputMT/MT_novo.json --test "a,b,aab,abb,abab"
```

**Valide**:
- ✅ Todos os casos válidos aceitam?
- ✅ Todos os casos inválidos rejeitam?
- ✅ Casos extremos funcionam (vazio, 1 símbolo, muito longo)?

### PASSO 9: VERIFICAÇÃO ESPECÍFICA PARA MTND

```powershell
# Verificar se há múltiplas transições (não-determinismo)
$json = Get-Content inputMT_ND/MTND_novo.json | ConvertFrom-Json
$trans = $json.definition -split "`n" | Where-Object { $_ -match '^q' }
$grouped = $trans | Group-Object { ($_ -split ',')[0..1] -join ',' }
$nondet = $grouped | Where-Object { $_.Count -gt 1 }

if ($nondet) {
    Write-Host "✓ NÃO-DETERMINÍSTICA detectada: $($nondet.Count) pares" -ForegroundColor Green
    $nondet | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Yellow }
} else {
    Write-Host "✗ DETERMINÍSTICA - adicione múltiplas transições!" -ForegroundColor Red
}
```

### PASSO 10: OTIMIZAÇÃO E REFINAMENTO

Se a MT funciona mas pode melhorar:

1. **Reduzir estados**: Combine estados com mesma função
2. **Reduzir transições**: Agrupe casos similares
3. **Melhorar complexidade**:
   - MT O(n²) → MT Multifita O(n)
   - MT O(n²) → MTND O(n)

---

## 📋 TEMPLATE COMPLETO DE WORKFLOW

```markdown
### Problema: [DESCREVER LINGUAGEM]

**1. ANÁLISE**
- Tipo: [Regular/Livre-contexto/Recursiva]
- Estrutura: [a^n b^n, ww^R, etc.]
- Complexidade alvo: [O(1), O(n), O(n²)]

**2. MODELO ESCOLHIDO**
- [ ] MT Padrão (Determinística)
- [ ] MT Multifita (k=?)
- [ ] MTND

**Justificativa**: [Por que este modelo?]

**3. ALGORITMO**
```
[Pseudocódigo passo a passo]
```

**4. ARQUIVO JSON**
- Caminho: `inputMT/MT_[nome].json`
- Estados: [listar]
- Alfabeto entrada: [listar]
- Alfabeto fita: [listar]
- Transições críticas: [destacar principais]

**5. TESTES**
| Entrada | Esperado | Resultado | Status |
|---------|----------|-----------|--------|
| ""      | ACEITA   | ?         | ⏳     |
| "ab"    | ACEITA   | ?         | ⏳     |
| "aabb"  | ACEITA   | ?         | ⏳     |
| "a"     | REJEITA  | ?         | ⏳     |

**6. DEBUG (se falhar)**
```bash
node cli.js --def inputMT/MT_[nome].json --input "[caso]" --verbose
```

**Problemas encontrados**: [listar]
**Soluções aplicadas**: [listar]

**7. VALIDAÇÃO FINAL**
```bash
node cli.js --def inputMT/MT_[nome].json --test "[todos,os,casos]"
```

✅ Todos testes passaram
📊 Diagrama gerado: `diagramasMT/MT_[nome].pdf`
```

---

## 🔄 PROCESSO ITERATIVO DE CORREÇÃO

Quando uma MT falha nos testes:

### Ciclo de Debug:
```
1. IDENTIFICAR falha
   ↓
2. ISOLAR caso mínimo que falha
   ↓
3. VERBOSE no caso mínimo
   ↓
4. ANALISAR log passo a passo
   ↓
5. IDENTIFICAR transição/estado problemático
   ↓
6. CORRIGIR transição específica
   ↓
7. TESTAR caso mínimo novamente
   ↓
8. Se passou: testar casos completos
   Se falhou: voltar ao passo 3
```

### Ferramentas de Debug:
1. **Verbose detalhado**: `--verbose`
2. **Teste único**: `--input "caso"`
3. **Teste batch**: `--test "caso1,caso2,caso3"`
4. **Script PowerShell**: Verificar não-determinismo
5. **Diagrama visual**: Analisar PDF gerado

---

## 💡 EXEMPLOS DE RESOLUÇÃO COMPLETA

### Exemplo 1: Resolver L = {a^n b^n | n ≥ 0}

**PASSO 1 - ANÁLISE**
- Tipo: Livre de contexto
- Estrutura: a^n b^n (potências iguais)
- Complexidade: O(n²) aceitável

**PASSO 2 - MODELO**: MT Padrão ✅

**PASSO 3 - ALGORITMO**:
```
q0: String vazia? → qf (aceita)
    Tem 'a'? → marca com X, vai q1
q1: Busca primeiro 'b' não marcado
    Acha? → marca com Y, vai q2
q2: Volta ao início (primeiro X)
    Repete em q0
qf: Todos marcados → aceita
qr: Sobrou símbolo → rejeita
```

**PASSO 4 - CRIAR JSON**: `inputMT/MT_anbn.json`

**PASSO 5 - TESTE INICIAL**:
```bash
node cli.js --def inputMT/MT_anbn.json
```

**PASSO 6 - CASOS SIMPLES**:
```bash
node cli.js --def inputMT/MT_anbn.json --input ""     # Deve aceitar
node cli.js --def inputMT/MT_anbn.json --input "ab"   # Deve aceitar
node cli.js --def inputMT/MT_anbn.json --input "aabb" # Deve aceitar
```

**PASSO 7 - DEBUG** (se falhar):
```bash
node cli.js --def inputMT/MT_anbn.json --input "ab" --verbose
# Analisar cada transição
```

**PASSO 8 - BATCH**:
```bash
node cli.js --def inputMT/MT_anbn.json --test "ab,aabb,aaabbb,a,abb,aab"
```

### Exemplo 2: Resolver L = {ww^R | w ∈ {a,b}*} com MTND

**PASSO 1 - ANÁLISE**
- Tipo: Palíndromos pares
- Estrutura: w seguido de w reverso
- Complexidade: O(n) com não-determinismo

**PASSO 2 - MODELO**: MTND ✅

**PASSO 3 - ALGORITMO**:
```
q0: Marca primeiro símbolo com X (se 'a') ou Y (se 'b')
q_scan: Avança pela fita
    **NÃO-DET**: Continua OU para (adivinha meio)
q_mark_end: Marca último símbolo não marcado
    Verifica se corresponde ao primeiro marcado
q_back: Volta ao início
    Repete em q0
qf: Todos marcados corretamente → aceita
```

**PASSO 4 - CRIAR JSON**: `inputMT_ND/MTND_palindrome.json`
- **IMPORTANTE**: `"nondeterministic": true`
- **IMPORTANTE**: Múltiplas transições em q_scan:
  ```
  q_scan, a, q_scan, a, R       # Opção 1: continua
  q_scan, a, q_mark_end, a, L   # Opção 2: para aqui
  ```

**PASSO 9 - VERIFICAR NÃO-DETERMINISMO**:
```powershell
# Script de verificação
$json = Get-Content inputMT_ND/MTND_palindrome.json | ConvertFrom-Json
$trans = $json.definition -split "`n" | Where-Object { $_ -match '^q' }
$grouped = $trans | Group-Object { ($_ -split ',')[0..1] -join ',' }
$nondet = $grouped | Where-Object { $_.Count -gt 1 }
$nondet | ForEach-Object { Write-Host $_.Name -ForegroundColor Yellow }
```

**PASSO 8 - TESTES**:
```bash
node cli.js --def inputMT_ND/MTND_palindrome.json --test "aa,abba,baab,a,ab,aba"
# aa, abba, baab → ACEITA (palíndromos pares)
# a, ab, aba → REJEITA (ímpares ou não-palíndromos)
```

---

**Última atualização**: Dezembro 2025
**Versão**: 2.0
**Autor**: Equipe Ferramentas LFA
