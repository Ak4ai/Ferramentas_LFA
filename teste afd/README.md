# Gerador de Palavras para AFD

Este programa permite definir um Autômato Finito Determinístico (AFD) através de texto e gerar todas as palavras possíveis aceitas por ele até um tamanho máximo especificado.

## Como usar

### Executar o programa:
```bash
python afd_generator.py
```

## Duas formas de definir o AFD:

### 1. Através de arquivo de texto

Crie um arquivo `.txt` seguindo este formato:

```
Estados: q0,q1,q2
Alfabeto: a,b
Estado_inicial: q0
Estados_finais: q2
Transicoes:
q0,a,q1
q0,b,q0
q1,a,q2
q1,b,q0
q2,a,q2
q2,b,q2
```

**Explicação do formato:**
- `Estados:` lista todos os estados separados por vírgula
- `Alfabeto:` lista todos os símbolos do alfabeto separados por vírgula
- `Estado_inicial:` define o estado inicial
- `Estados_finais:` lista os estados finais separados por vírgula
- `Transicoes:` seção onde cada linha define uma transição no formato `estado_origem,simbolo,estado_destino`

### 2. Entrada interativa

O programa solicitará que você digite:
1. Os estados
2. O alfabeto
3. O estado inicial
4. Os estados finais
5. As transições uma por uma

## Exemplo de AFD (exemplo_afd.txt)

O arquivo `exemplo_afd.txt` contém um AFD que aceita palavras que contêm pelo menos duas letras 'a'.

**Estados:**
- q0: estado inicial (nenhum 'a' lido)
- q1: um 'a' foi lido
- q2: dois ou mais 'a's foram lidos (estado final)

**Palavras aceitas por este AFD (até tamanho 4):**
- aa
- aaa
- aab
- aba
- abb
- baa
- bab
- aaaa
- aaab
- aaba
- aabb
- abaa
- abab
- abba
- abbb
- baaa
- baab
- baba
- babb
- bbaa
- bbab

## Funcionalidades

1. **Geração de palavras**: Lista todas as palavras aceitas até um tamanho máximo
2. **Teste de palavras**: Permite testar palavras específicas para ver se são aceitas
3. **Validação**: Verifica se a definição do AFD está correta
4. **Interface amigável**: Entrada interativa ou por arquivo

## Limitações

- O programa gera palavras até um tamanho máximo para evitar loops infinitos
- Para AFDs que aceitam linguagens infinitas, apenas uma amostra finita será mostrada
- Tamanhos muito grandes podem demorar para processar

## Exemplos de uso

### Exemplo 1: AFD que aceita palavras terminadas em 'a'
```
Estados: q0,q1
Alfabeto: a,b
Estado_inicial: q0
Estados_finais: q1
Transicoes:
q0,a,q1
q0,b,q0
q1,a,q1
q1,b,q0
```

### Exemplo 2: AFD que aceita palavras com número par de 'a's
```
Estados: q0,q1
Alfabeto: a,b
Estado_inicial: q0
Estados_finais: q0
Transicoes:
q0,a,q1
q0,b,q0
q1,a,q0
q1,b,q1
```

## Dicas

- Comece com tamanhos pequenos (5-7) para ver o padrão das palavras
- Use o teste de palavras específicas para verificar casos particulares
- Mantenha a definição do AFD simples para facilitar a análise
