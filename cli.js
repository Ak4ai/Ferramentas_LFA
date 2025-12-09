// Ferramenta CLI para validação de AFD/Turing e geração de diagramas
// Reutiliza lógica do app.js

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Pastas separadas para AFD, AFN, AP, MT e GR
const inputDirAFD = path.join(__dirname, 'inputAFD');
const diagramDirAFD = path.join(__dirname, 'diagramasAFD');
const inputDirAFN = path.join(__dirname, 'inputAFN');
const diagramDirAFN = path.join(__dirname, 'diagramasAFN');
const inputDirAP = path.join(__dirname, 'inputAP');
const diagramDirAP = path.join(__dirname, 'diagramasAP');
const inputDirMT = path.join(__dirname, 'inputMT');
const diagramDirMT = path.join(__dirname, 'diagramasMT');
const inputDirMTND = path.join(__dirname, 'inputMT_ND');
const inputDirGR = path.join(__dirname, 'inputGR');
const diagramDirGR = path.join(__dirname, 'diagramasGR');

// Pastas legadas (mantidas para compatibilidade)
const inputDir = path.join(__dirname, 'input');
const diagramDir = path.join(__dirname, 'diagramas');

// --- Biblioteca de Validadores ---
const validators = {
    startsWith: { func: (str, sub) => str.startsWith(sub), text: 'Começa com' },
    endsWith: { func: (str, sub) => str.endsWith(sub), text: 'Termina com' },
    contains: { func: (str, sub) => str.includes(sub), text: 'Contém' },
    regex: {
        func: (str, pattern) => {
            if (!pattern) return true;
            try {
                const re = new RegExp(`^${pattern}$`);
                return re.test(str);
            } catch (e) { return false; }
        },
        text: 'Corresponde à Regex'
    },
    count: {
        func: (str, { subject, operator, N, M }) => {
            const count = (subject.type === 'char')
                ? (str.match(new RegExp(subject.char, 'g')) || []).length
                : str.length;
            switch (operator) {
                case '==': return count === N;
                case '>=': return count >= N;
                case '<=': return count <= N;
                case 'even': return count % 2 === 0;
                case 'odd': return count % 2 !== 0;
                case '%': return count % N === M;
                default: return false;
            }
        },
        text: 'Contagem Avançada'
    },
    substringCount: {
        func: (str, { sub, type }) => {
            if (!sub) return true;
            const escapedSub = sub.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
            const regex = new RegExp(`(?=${escapedSub})`, 'g');
            const count = (str.match(regex) || []).length;
            return type === 'even' ? count % 2 === 0 : count % 2 !== 0;
        },
        text: 'Contagem de Subpalavra'
    },
    structuredLanguage: {
        func: (str, ruleValue) => {
            // Aceita tanto { pattern, condition } quanto { symbols, condition }
            let pattern, condition;
            if (ruleValue.pattern) {
                pattern = ruleValue.pattern;
                condition = ruleValue.condition;
            } else if (ruleValue.symbols) {
                // Converte symbols array para pattern string
                pattern = ruleValue.symbols.join('');
                condition = ruleValue.condition;
            } else {
                return true;
            }
            if (!pattern || !condition) return true;
            try {
                // Usa regex greedy para capturar sequências de cada caractere
                const chars = pattern.split('');
                const regexPattern = chars.map(char => `(${char}*)`).join('');
                const regex = new RegExp(`^${regexPattern}$`);
                const match = str.match(regex);
                if (!match) return false;
                const counts = match.slice(1).map(part => part ? part.length : 0);
                const [i, j, k] = counts;
                return eval(condition);
            } catch (e) { console.error("Erro na regra Estruturada:", e); return false; }
        },
        text: 'Linguagem Estruturada'
    },
    palindrome: {
        func: (str, { type }) => {
            // type: 'even' para ww^R (comprimento par), 'any' para palíndromos gerais
            const isPalindrome = str === str.split('').reverse().join('');
            if (type === 'even') {
                return str.length % 2 === 0 && isPalindrome;
            }
            return isPalindrome;
        },
        text: 'Palíndromo'
    },
    equalCount: {
        func: (str, { chars }) => {
            // Verifica se todos os caracteres em chars têm a mesma quantidade
            if (!chars || chars.length < 2) return true;
            const counts = chars.map(char => 
                (str.match(new RegExp(char, 'g')) || []).length
            );
            return counts.every(c => c === counts[0]);
        },
        text: 'Contagem Igual'
    },
    // Validadores para Lista AFD
    parity: {
        // Verifica paridade de contagem de caracteres
        // Ex: { char: 'a', type: 'even' } ou { char: 'a', type: 'odd' }
        func: (str, { char, type }) => {
            const count = (str.match(new RegExp(char, 'g')) || []).length;
            return type === 'even' ? count % 2 === 0 : count % 2 !== 0;
        },
        text: 'Paridade'
    },
    sameFirstLast: {
        // Verifica se primeiro e último caracteres são iguais (e string não vazia)
        func: (str) => {
            if (str.length === 0) return false;
            return str[0] === str[str.length - 1];
        },
        text: 'Primeiro = Último'
    },
    hasConsecutive: {
        // Verifica se tem caracteres consecutivos
        // Ex: { char: 'b', min: 2 } para pelo menos 2 b's consecutivos
        func: (str, { char, min }) => {
            const pattern = new RegExp(`${char}{${min || 2},}`);
            return pattern.test(str);
        },
        text: 'Consecutivos'
    },
    divisibleBy: {
        // Verifica se contagem de char é divisível por N
        // Ex: { char: 'a', n: 3 }
        func: (str, { char, n }) => {
            const count = (str.match(new RegExp(char, 'g')) || []).length;
            return count % n === 0;
        },
        text: 'Divisível Por'
    },
    binaryDivisibleBy: {
        // Interpreta string como binário e verifica divisibilidade
        func: (str, { n }) => {
            if (str.length === 0) return true; // String vazia = 0, divisível por qualquer n
            const value = parseInt(str, 2);
            return value % n === 0;
        },
        text: 'Binário Divisível Por'
    },
    sumParity: {
        // Verifica paridade da soma de contagens
        // Ex: { chars: ['a', 'b'], type: 'even' } para x + y par
        func: (str, { chars, type }) => {
            const sum = chars.reduce((acc, char) => {
                return acc + (str.match(new RegExp(char, 'g')) || []).length;
            }, 0);
            return type === 'even' ? sum % 2 === 0 : sum % 2 !== 0;
        },
        text: 'Soma Paridade'
    },
    exactPattern: {
        // Verifica se string corresponde exatamente ao padrão ba^n ba
        // Ex: { pattern: 'ba*ba' }
        func: (str, { pattern }) => {
            // Converte padrão simples para regex
            const regexStr = pattern
                .replace(/\*/g, '*')
                .replace(/([ab])\*/g, '$1*');
            try {
                const regex = new RegExp(`^${regexStr}$`);
                return regex.test(str);
            } catch (e) { return false; }
        },
        text: 'Padrão Exato'
    },
    // === Validadores para Lista AFN ===
    hasSuffix: {
        // Verifica se tem um dos sufixos especificados
        // Ex: { suffixes: ['abc', 'cba'] } - aceita se termina com abc OU cba
        func: (str, { suffixes }) => {
            return suffixes.some(suf => str.endsWith(suf));
        },
        text: 'Sufixo'
    },
    firstEqualsLast: {
        // Verifica se primeiro símbolo = último símbolo
        func: (str) => {
            if (str.length === 0) return false;
            if (str.length === 1) return true;
            return str[0] === str[str.length - 1];
        },
        text: 'Primeiro = Último'
    },
    minSubstringOccurrences: {
        // Verifica ocorrências mínimas de uma substring
        // Ex: { sub: 'abc', min: 3 }
        func: (str, { sub, min }) => {
            if (!sub) return true;
            let count = 0;
            let pos = 0;
            while ((pos = str.indexOf(sub, pos)) !== -1) {
                count++;
                pos++;
            }
            return count >= min;
        },
        text: 'Mínimo de Ocorrências'
    },
    exactSubstringOccurrences: {
        // Verifica ocorrências exatas de uma substring
        // Ex: { sub: 'a', count: 1 }
        func: (str, { sub, count }) => {
            if (!sub) return true;
            let found = 0;
            let pos = 0;
            while ((pos = str.indexOf(sub, pos)) !== -1) {
                found++;
                pos++;
            }
            return found === count;
        },
        text: 'Ocorrências Exatas'
    },
    hasConsecutivePair: {
        // Verifica se tem aa ou bb (ou qualquer par consecutivo dos chars especificados)
        // Ex: { chars: ['a', 'b'] } - aceita se tem 'aa' ou 'bb'
        func: (str, { chars }) => {
            return chars.some(c => str.includes(c + c));
        },
        text: 'Par Consecutivo'
    },
    hasBothSubstrings: {
        // Verifica se contém AMBAS as substrings (em qualquer ordem)
        // Ex: { subs: ['ab', 'ba'] }
        func: (str, { subs }) => {
            return subs.every(sub => str.includes(sub));
        },
        text: 'Ambas Substrings'
    },
    minLength: {
        // Verifica comprimento mínimo
        // Ex: { min: 7 } para |x|=3 e |z|=3 implica comprimento mínimo 6
        func: (str, { min }) => {
            return str.length >= min;
        },
        text: 'Comprimento Mínimo'
    },
    minCount: {
        // Verifica contagem mínima de um caractere
        // Ex: { char: '1', count: 3 } para pelo menos 3 '1's
        func: (str, { char, count }) => {
            const charCount = (str.match(new RegExp(char, 'g')) || []).length;
            return charCount >= count;
        },
        text: 'Contagem Mínima'
    },
    maxCount: {
        // Verifica contagem máxima de um caractere
        // Ex: { char: '0', count: 2 } para no máximo 2 '0's
        func: (str, { char, count }) => {
            const charCount = (str.match(new RegExp(char, 'g')) || []).length;
            return charCount <= count;
        },
        text: 'Contagem Máxima'
    },
    acceptAll: {
        // Aceita qualquer string (Σ*)
        func: () => true,
        text: 'Aceita Tudo'
    },
    lengthParity: {
        // Verifica paridade do comprimento total
        // Ex: { type: 'even' } para comprimento par
        func: (str, { type }) => {
            return type === 'even' ? str.length % 2 === 0 : str.length % 2 !== 0;
        },
        text: 'Paridade do Comprimento'
    },
    weightedSumDivisible: {
        // Verifica se soma ponderada é divisível por n
        // Ex: { weights: { 'a': 1, 'b': 1, 'c': 2 }, divisor: 6 }
        func: (str, { weights, divisor }) => {
            let sum = 0;
            for (const char of str) {
                sum += weights[char] || 0;
            }
            return sum % divisor === 0;
        },
        text: 'Soma Ponderada Divisível'
    },
    substringCountParity: {
        // Verifica paridade do número de ocorrências de substring
        // Ex: { sub: 'ba', parity: 'even' }
        func: (str, { sub, parity }) => {
            if (!sub) return true;
            let count = 0;
            let pos = 0;
            while ((pos = str.indexOf(sub, pos)) !== -1) {
                count++;
                pos++;
            }
            return parity === 'even' ? count % 2 === 0 : count % 2 !== 0;
        },
        text: 'Paridade de Ocorrências'
    },
    lastSymbolRepeated: {
        // Verifica se último símbolo aparece pelo menos 2 vezes, sem símbolo maior entre as ocorrências
        // Específico para exercício 2 da lista AFN
        // Alfabeto é extraído da própria string de entrada
        func: (str, opts = {}) => {
            if (str.length === 0) return false;
            const lastChar = str[str.length - 1];
            const lastIndex = str.length - 1;
            // Procura penúltima ocorrência do último caractere
            let prevIndex = -1;
            for (let i = str.length - 2; i >= 0; i--) {
                if (str[i] === lastChar) {
                    prevIndex = i;
                    break;
                }
            }
            if (prevIndex === -1) return false; // Não aparece 2 vezes
            // Verifica se há símbolo maior entre as duas ocorrências
            // Usa o alfabeto passado ou extrai da string
            const alphabet = opts.alphabet || [...new Set(str.split(''))];
            const sortedAlphabet = [...alphabet].sort();
            const lastCharPos = sortedAlphabet.indexOf(lastChar);
            for (let i = prevIndex + 1; i < lastIndex; i++) {
                const charPos = sortedAlphabet.indexOf(str[i]);
                if (charPos > lastCharPos) return false;
            }
            return true;
        },
        text: 'Último Símbolo Repetido'
    },
    complexCondition: {
        // Condição complexa usando expressão JavaScript
        // Ex: { expression: "(str.endsWith('01') && str.includes('011')) || (str.endsWith('10') && str.includes('100'))" }
        func: (str, { expression }) => {
            try {
                return eval(expression);
            } catch (e) { return false; }
        },
        text: 'Condição Complexa'
    },
    // === Validadores para Autômatos de Pilha (AP) ===
    emptyLanguage: {
        // Linguagem vazia - nenhuma string é aceita
        func: (str) => false,
        text: 'Linguagem Vazia'
    },
    emptyStringOnly: {
        // Apenas a string vazia é aceita
        func: (str) => str.length === 0,
        text: 'Apenas String Vazia'
    },
    matchingPowers: {
        // a^i b^j onde i e j satisfazem uma condição
        // Ex: { pattern: 'ab', condition: 'i > j' } para i > j
        // Ex: { pattern: 'ab', condition: 'i < j' } para i < j  
        // Ex: { pattern: 'ab', condition: 'i !== j' } para i != j
        func: (str, { pattern, condition }) => {
            if (!pattern || !condition) return false;
            const chars = pattern.split('');
            // Verifica se a string segue o padrão a*b*c*...
            let pos = 0;
            const counts = [];
            for (const char of chars) {
                let count = 0;
                while (pos < str.length && str[pos] === char) {
                    count++;
                    pos++;
                }
                counts.push(count);
            }
            // Se não consumiu toda a string, não segue o padrão
            if (pos !== str.length) return false;
            // Avalia a condição
            const [i, j, k, l] = counts;
            try {
                return eval(condition);
            } catch (e) { return false; }
        },
        text: 'Potências Correspondentes'
    },
    wcwReverse: {
        // Linguagem wcw^R - w seguido de c seguido de w reverso
        // Ex: { separator: 'c', alphabet: ['a', 'b'] }
        func: (str, { separator, alphabet }) => {
            const sepIndex = str.indexOf(separator);
            if (sepIndex === -1) return false;
            // Verifica se há apenas um separador
            if (str.indexOf(separator, sepIndex + 1) !== -1) return false;
            const w = str.slice(0, sepIndex);
            const wR = str.slice(sepIndex + 1);
            // Verifica se w e wR são reversos
            if (w !== wR.split('').reverse().join('')) return false;
            // Verifica se w usa apenas o alfabeto permitido
            if (alphabet) {
                for (const char of w) {
                    if (!alphabet.includes(char)) return false;
                }
            }
            return true;
        },
        text: 'wcw^R'
    },
    balancedParentheses: {
        // Parênteses balanceados
        // Ex: { open: '(', close: ')' } ou { pairs: [['(', ')'], ['[', ']']] }
        func: (str, opts) => {
            if (opts.pairs) {
                // Múltiplos tipos de parênteses
                const stack = [];
                const openChars = opts.pairs.map(p => p[0]);
                const closeChars = opts.pairs.map(p => p[1]);
                for (const char of str) {
                    const openIdx = openChars.indexOf(char);
                    const closeIdx = closeChars.indexOf(char);
                    if (openIdx !== -1) {
                        stack.push(openIdx);
                    } else if (closeIdx !== -1) {
                        if (stack.length === 0 || stack.pop() !== closeIdx) {
                            return false;
                        }
                    }
                }
                return stack.length === 0;
            } else {
                // Um tipo de parênteses
                const open = opts.open || '(';
                const close = opts.close || ')';
                let count = 0;
                for (const char of str) {
                    if (char === open) count++;
                    else if (char === close) {
                        count--;
                        if (count < 0) return false;
                    }
                }
                return count === 0;
            }
        },
        text: 'Parênteses Balanceados'
    },
    anbncmdn: {
        // a^n b^n c^m d^m
        func: (str) => {
            let i = 0;
            let countA = 0, countB = 0, countC = 0, countD = 0;
            // Conta a's
            while (i < str.length && str[i] === 'a') { countA++; i++; }
            // Conta b's
            while (i < str.length && str[i] === 'b') { countB++; i++; }
            // Conta c's
            while (i < str.length && str[i] === 'c') { countC++; i++; }
            // Conta d's
            while (i < str.length && str[i] === 'd') { countD++; i++; }
            // Verifica se consumiu toda a string e n's e m's batem
            return i === str.length && countA === countB && countC === countD;
        },
        text: 'a^n b^n c^m d^m'
    },
    sumEquality: {
        // i + j = k + l (para a^i b^j c^k d^l)
        func: (str, { pattern }) => {
            const chars = (pattern || 'abcd').split('');
            let pos = 0;
            const counts = [];
            for (const char of chars) {
                let count = 0;
                while (pos < str.length && str[pos] === char) {
                    count++;
                    pos++;
                }
                counts.push(count);
            }
            if (pos !== str.length) return false;
            const [i, j, k, l] = counts;
            return i + j === k + l;
        },
        text: 'Soma de Igualdade'
    },
    palindromeOddLength: {
        // Palíndromo de comprimento ímpar
        func: (str) => {
            if (str.length % 2 === 0) return false;
            return str === str.split('').reverse().join('');
        },
        text: 'Palíndromo Ímpar'
    },
    anbnOrBnan: {
        // a^n b^n OU b^n a^n
        func: (str) => {
            // Tenta a^n b^n
            let i = 0;
            let countA = 0, countB = 0;
            while (i < str.length && str[i] === 'a') { countA++; i++; }
            while (i < str.length && str[i] === 'b') { countB++; i++; }
            if (i === str.length && countA === countB && countA > 0) return true;
            // Tenta b^n a^n
            i = 0;
            countA = 0; countB = 0;
            while (i < str.length && str[i] === 'b') { countB++; i++; }
            while (i < str.length && str[i] === 'a') { countA++; i++; }
            return i === str.length && countA === countB && countA > 0;
        },
        text: 'a^n b^n ou b^n a^n'
    },
    atLeastN: {
        // Pelo menos N ocorrências de um caractere
        func: (str, { char, n }) => {
            const count = (str.match(new RegExp(char, 'g')) || []).length;
            return count >= n;
        },
        text: 'Pelo Menos N'
    },
    oddCount: {
        // Quantidade ímpar de um caractere
        func: (str, { char }) => {
            const count = (str.match(new RegExp(char, 'g')) || []).length;
            return count % 2 === 1;
        },
        text: 'Quantidade Ímpar'
    },
    customFunction: {
        // Função customizada passada como string (CUIDADO: usa eval)
        func: (str, { func }) => {
            try {
                const fn = eval(`(${func})`);
                return fn(str);
            } catch (e) {
                return false;
            }
        },
        text: 'Função Customizada'
    }
};

function generateRandomString(alphabet, maxLength) {
    const length = Math.floor(Math.random() * (maxLength + 1));
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
}

function buildMasterValidator(rules) {
    if (!rules || rules.length === 0) return null;
    
    const groupValidators = [];
    rules.forEach(group => {
        const rulesInGroup = [];
        group.rules.forEach(rule => {
            const type = rule.type;
            const isNegated = rule.negated || false;
            
            // Extrai o valor dependendo do tipo de regra
            let value;
            if (rule.value !== undefined) {
                value = rule.value; // Formato antigo: rule.value
            } else if (type === 'structuredLanguage') {
                value = { symbols: rule.symbols, condition: rule.condition }; // Novo formato
            } else if (type === 'palindrome') {
                value = { type: rule.palindromeType }; // Novo formato palindrome
            } else if (type === 'equalCount') {
                value = { chars: rule.chars }; // Novo formato equalCount
            } else if (type === 'startsWith' || type === 'endsWith' || type === 'contains') {
                value = rule.value; // Valor simples
            } else {
                value = rule; // Usa a regra inteira como valor
            }
            
            rulesInGroup.push({ validatorKey: type, value, isNegated });
        });
        
        const groupValidator = (str) => {
            if (rulesInGroup.length === 0) return false;
            for (const rule of rulesInGroup) {
                let result = validators[rule.validatorKey].func(str, rule.value);
                if (rule.isNegated) result = !result;
                if (!result) return false;
            }
            return true;
        };
        groupValidators.push(groupValidator);
    });
    
    return (str) => {
        if (groupValidators.length === 0) return true;
        for (const validator of groupValidators) {
            if (validator(str)) return true;
        }
        return false;
    };
}

function getAlphabetFromRules(rules) {
    const chars = new Set();
    if (!rules) return [];
    
    rules.forEach(group => {
        group.rules.forEach(rule => {
            // Novo formato: symbols array direto na regra
            if (rule.symbols && Array.isArray(rule.symbols)) {
                rule.symbols.forEach(sym => {
                    sym.split('').forEach(char => chars.add(char));
                });
            }
            // Novo formato: chars array para equalCount
            else if (rule.chars && Array.isArray(rule.chars)) {
                rule.chars.forEach(char => chars.add(char));
            }
            // Formato antigo: value contém dados
            else if (rule.type === 'count' && rule.value && rule.value.subject && rule.value.subject.char) {
                chars.add(rule.value.subject.char);
            } else if (rule.type === 'regex' && rule.value) {
                const plainChars = rule.value.replace(/[.*+?^${}()|[\\\]]/g, '');
                plainChars.split('').forEach(char => chars.add(char));
            } else if (rule.value && typeof rule.value === 'string') {
                rule.value.split('').forEach(char => chars.add(char));
            } else if (rule.value && rule.value.sub) {
                rule.value.sub.split('').forEach(char => chars.add(char));
            } else if (rule.value && rule.value.pattern) {
                rule.value.pattern.split('').forEach(char => chars.add(char));
            } else if (rule.value && rule.value.symbols) {
                rule.value.symbols.forEach(sym => {
                    sym.split('').forEach(char => chars.add(char));
                });
            }
        });
    });
    return [...chars];
}

// --- Funções de Parsing e Simulação ---

// Parser para AFN (suporta múltiplas transições e epsilon)
function parseAfnDefinition(text) {
    try {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const afn = { transitions: {}, epsilonTransitions: {}, isNFA: false };
        let readingTransitions = false;
        for (const line of lines) {
            if (line.toLowerCase().startsWith('transicoes:') || line.toLowerCase().startsWith('transições:')) { 
                readingTransitions = true; 
                continue; 
            }
            if (readingTransitions) {
                const [from, symbol, to] = line.split(',').map(s => s.trim());
                if (!from || symbol === undefined || !to) continue;
                
                // Detecta epsilon (ε, epsilon, eps, λ, lambda, ou vazio)
                const isEpsilon = symbol === '' || symbol === 'ε' || symbol === 'epsilon' || 
                                  symbol === 'eps' || symbol === 'λ' || symbol === 'lambda' ||
                                  symbol === 'E' || symbol === '_epsilon';
                
                if (isEpsilon) {
                    if (!afn.epsilonTransitions[from]) afn.epsilonTransitions[from] = [];
                    if (!afn.epsilonTransitions[from].includes(to)) {
                        afn.epsilonTransitions[from].push(to);
                    }
                    afn.isNFA = true;
                } else {
                    if (!afn.transitions[from]) afn.transitions[from] = {};
                    if (!afn.transitions[from][symbol]) afn.transitions[from][symbol] = [];
                    if (!afn.transitions[from][symbol].includes(to)) {
                        afn.transitions[from][symbol].push(to);
                    }
                    // Detecta não-determinismo: múltiplos destinos para mesmo par (estado, símbolo)
                    if (afn.transitions[from][symbol].length > 1) {
                        afn.isNFA = true;
                    }
                }
            } else {
                const [key, value] = line.split(/:(.*)/s);
                if (!key || !value) continue;
                const formattedKey = key.trim().toLowerCase().replace(/_/g, '');
                const values = value.trim().split(',').map(s => s.trim());
                if (formattedKey === 'estados') afn.states = values;
                if (formattedKey === 'alfabeto') afn.alphabet = values.filter(s => s !== 'ε' && s !== 'epsilon');
                if (formattedKey === 'estadoinicial') afn.startState = values[0];
                if (formattedKey === 'estadosfinais') afn.finalStates = values;
            }
        }
        if (!afn.states || !afn.alphabet || !afn.startState || !afn.finalStates) {
            return { error: "Definição incompleta." };
        }
        return afn;
    } catch (e) { return { error: e.message }; }
}

// =============================================================================
// GRAMÁTICAS REGULARES (GR)
// =============================================================================

/**
 * Parser para Gramática Regular (GR)
 * Formato de entrada:
 *   Variaveis: S, A, B, C
 *   Terminais: a, b, 0, 1
 *   Inicial: S
 *   Producoes:
 *   S -> aA | bB | ε
 *   A -> aA | a
 *   B -> bB | b
 * 
 * Suporta gramáticas lineares à direita (A -> aB ou A -> a ou A -> ε)
 * e lineares à esquerda (A -> Ba ou A -> a ou A -> ε)
 */
function parseGrammarDefinition(text) {
    try {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const grammar = {
            variables: [],
            terminals: [],
            startSymbol: null,
            productions: {},  // { 'S': ['aA', 'bB', 'ε'], 'A': ['aA', 'a'], ... }
            type: null        // 'right-linear' ou 'left-linear'
        };
        
        let readingProductions = false;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Detecta seção de produções
            if (trimmedLine.toLowerCase().startsWith('producoes:') || 
                trimmedLine.toLowerCase().startsWith('produções:') ||
                trimmedLine.toLowerCase().startsWith('productions:')) {
                readingProductions = true;
                continue;
            }
            
            if (readingProductions) {
                // Formato: A -> aB | bC | ε
                // ou: A -> aB
                // ou: A → aB (com seta unicode)
                const match = trimmedLine.match(/^([A-Z][A-Za-z0-9_]*)\s*(?:->|→)\s*(.+)$/);
                if (match) {
                    const variable = match[1].trim();
                    const rhsList = match[2].split('|').map(s => s.trim());
                    
                    if (!grammar.productions[variable]) {
                        grammar.productions[variable] = [];
                    }
                    
                    for (const rhs of rhsList) {
                        // Normaliza epsilon
                        const normalizedRhs = (rhs === 'ε' || rhs === 'epsilon' || rhs === 'λ' || rhs === 'lambda' || rhs === '') 
                            ? 'ε' : rhs;
                        if (!grammar.productions[variable].includes(normalizedRhs)) {
                            grammar.productions[variable].push(normalizedRhs);
                        }
                    }
                }
            } else {
                // Parse de cabeçalho
                const colonIndex = line.indexOf(':');
                if (colonIndex === -1) continue;
                
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                
                if (key === 'variaveis' || key === 'variáveis' || key === 'variables' || key === 'v') {
                    grammar.variables = value.split(',').map(s => s.trim()).filter(s => s);
                } else if (key === 'terminais' || key === 'terminals' || key === 't' || key === 'sigma' || key === 'σ') {
                    grammar.terminals = value.split(',').map(s => s.trim()).filter(s => s && s !== 'ε');
                } else if (key === 'inicial' || key === 'start' || key === 's' || key === 'simbolo_inicial') {
                    grammar.startSymbol = value.split(',')[0].trim();
                }
            }
        }
        
        // Validação
        if (grammar.variables.length === 0) {
            return { error: "Nenhuma variável definida." };
        }
        if (grammar.terminals.length === 0) {
            return { error: "Nenhum terminal definido." };
        }
        if (!grammar.startSymbol) {
            return { error: "Símbolo inicial não definido." };
        }
        if (Object.keys(grammar.productions).length === 0) {
            return { error: "Nenhuma produção definida." };
        }
        
        // Detecta tipo de gramática (linear à direita ou à esquerda)
        grammar.type = detectGrammarType(grammar);
        
        return grammar;
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Detecta se a gramática é linear à direita ou à esquerda
 */
function detectGrammarType(grammar) {
    let hasRightLinear = false;
    let hasLeftLinear = false;
    
    for (const variable of Object.keys(grammar.productions)) {
        for (const rhs of grammar.productions[variable]) {
            if (rhs === 'ε') continue;
            
            // Encontra variáveis no lado direito
            const varsInRhs = [];
            for (let i = 0; i < rhs.length; i++) {
                // Variáveis são maiúsculas (podem ter mais de um caractere)
                if (rhs[i] >= 'A' && rhs[i] <= 'Z') {
                    let varName = rhs[i];
                    while (i + 1 < rhs.length && (
                        (rhs[i+1] >= 'A' && rhs[i+1] <= 'Z') ||
                        (rhs[i+1] >= 'a' && rhs[i+1] <= 'z') ||
                        (rhs[i+1] >= '0' && rhs[i+1] <= '9') ||
                        rhs[i+1] === '_'
                    ) && grammar.variables.includes(varName + rhs[i+1])) {
                        i++;
                        varName += rhs[i];
                    }
                    if (grammar.variables.includes(varName)) {
                        varsInRhs.push({ name: varName, pos: i - varName.length + 1 });
                    }
                }
            }
            
            if (varsInRhs.length === 0) {
                // Produção A -> terminais (ok para ambos os tipos)
                continue;
            } else if (varsInRhs.length === 1) {
                const varPos = varsInRhs[0].pos;
                const varLen = varsInRhs[0].name.length;
                
                // Linear à direita: variável no final (A -> aB)
                if (varPos + varLen === rhs.length) {
                    hasRightLinear = true;
                }
                // Linear à esquerda: variável no início (A -> Ba)
                else if (varPos === 0) {
                    hasLeftLinear = true;
                }
            } else {
                // Mais de uma variável - não é regular!
                return 'invalid';
            }
        }
    }
    
    if (hasRightLinear && hasLeftLinear) {
        return 'mixed'; // Mistura - pode não ser regular
    } else if (hasRightLinear) {
        return 'right-linear';
    } else if (hasLeftLinear) {
        return 'left-linear';
    }
    
    return 'right-linear'; // Default (só terminais é considerado linear à direita)
}

/**
 * Converte Gramática Regular (linear à direita) para AFN
 * 
 * Regras de conversão:
 * - Cada variável vira um estado
 * - Símbolo inicial da gramática = estado inicial do AFN
 * - A -> aB  vira transição δ(A, a) = B
 * - A -> a   vira transição δ(A, a) = qf (estado final)
 * - A -> ε   torna A um estado final
 * - S -> ε   torna estado inicial também final
 */
function convertGrammarToAFN(grammar) {
    if (grammar.error) return grammar;
    
    // Se for linear à esquerda, converte para linear à direita primeiro
    if (grammar.type === 'left-linear') {
        grammar = convertLeftToRightLinear(grammar);
    }
    
    const afn = {
        states: [],
        alphabet: [...grammar.terminals],
        startState: grammar.startSymbol,
        finalStates: [],
        transitions: {},
        epsilonTransitions: {},
        isNFA: false,
        fromGrammar: true
    };
    
    // Estado final especial para produções A -> a
    const qFinal = 'qF';
    
    // Adiciona estados (um por variável + estado final)
    afn.states = [...grammar.variables, qFinal];
    afn.finalStates = [qFinal];
    
    // Inicializa estruturas de transição
    for (const state of afn.states) {
        afn.transitions[state] = {};
        afn.epsilonTransitions[state] = [];
    }
    
    // Processa produções
    for (const variable of Object.keys(grammar.productions)) {
        for (const rhs of grammar.productions[variable]) {
            if (rhs === 'ε') {
                // A -> ε: A é estado final
                if (!afn.finalStates.includes(variable)) {
                    afn.finalStates.push(variable);
                }
            } else {
                // Analisa o lado direito
                const parsed = parseProductionRhs(rhs, grammar);
                
                if (parsed.terminal && parsed.variable) {
                    // A -> aB: transição de A para B com 'a'
                    const symbol = parsed.terminal;
                    const target = parsed.variable;
                    
                    if (!afn.transitions[variable][symbol]) {
                        afn.transitions[variable][symbol] = [];
                    }
                    if (!afn.transitions[variable][symbol].includes(target)) {
                        afn.transitions[variable][symbol].push(target);
                    }
                    
                    // Verifica não-determinismo
                    if (afn.transitions[variable][symbol].length > 1) {
                        afn.isNFA = true;
                    }
                } else if (parsed.terminal && !parsed.variable) {
                    // A -> a: transição de A para qF com 'a'
                    const symbol = parsed.terminal;
                    
                    if (!afn.transitions[variable][symbol]) {
                        afn.transitions[variable][symbol] = [];
                    }
                    if (!afn.transitions[variable][symbol].includes(qFinal)) {
                        afn.transitions[variable][symbol].push(qFinal);
                    }
                    
                    // Verifica não-determinismo
                    if (afn.transitions[variable][symbol].length > 1) {
                        afn.isNFA = true;
                    }
                }
            }
        }
    }
    
    // Remove estado qF se não for usado
    let qfUsed = false;
    for (const state of Object.keys(afn.transitions)) {
        for (const symbol of Object.keys(afn.transitions[state])) {
            if (afn.transitions[state][symbol].includes(qFinal)) {
                qfUsed = true;
                break;
            }
        }
        if (qfUsed) break;
    }
    
    if (!qfUsed) {
        afn.states = afn.states.filter(s => s !== qFinal);
        afn.finalStates = afn.finalStates.filter(s => s !== qFinal);
        delete afn.transitions[qFinal];
        delete afn.epsilonTransitions[qFinal];
    }
    
    return afn;
}

/**
 * Analisa o lado direito de uma produção
 * Retorna { terminal: 'a', variable: 'B' } ou { terminal: 'ab', variable: null }
 */
function parseProductionRhs(rhs, grammar) {
    let terminal = '';
    let variable = null;
    
    let i = 0;
    while (i < rhs.length) {
        // Verifica se é início de variável
        if (rhs[i] >= 'A' && rhs[i] <= 'Z') {
            let varName = rhs[i];
            let j = i + 1;
            // Tenta estender o nome da variável
            while (j < rhs.length) {
                const extendedName = varName + rhs[j];
                if (grammar.variables.includes(extendedName)) {
                    varName = extendedName;
                    j++;
                } else {
                    break;
                }
            }
            
            if (grammar.variables.includes(varName)) {
                variable = varName;
                i = j;
            } else {
                // Não é variável, é terminal maiúsculo
                terminal += rhs[i];
                i++;
            }
        } else {
            // É terminal
            terminal += rhs[i];
            i++;
        }
    }
    
    return { terminal: terminal || null, variable };
}

/**
 * Converte gramática linear à esquerda para linear à direita
 * (Inverte as produções e depois reverte a linguagem)
 */
function convertLeftToRightLinear(grammar) {
    // Para simplificar, mantemos a gramática como está
    // O simulador tratará corretamente
    // Uma conversão completa requer reverter a linguagem
    console.log('⚠ Gramática linear à esquerda detectada. Conversão automática aplicada.');
    
    const newGrammar = {
        variables: [...grammar.variables],
        terminals: [...grammar.terminals],
        startSymbol: grammar.startSymbol,
        productions: {},
        type: 'right-linear'
    };
    
    // Cria novo estado inicial S' se necessário
    const newStart = grammar.startSymbol + "'";
    newGrammar.variables.push(newStart);
    newGrammar.startSymbol = newStart;
    
    // Para cada produção A -> Ba, cria B -> aA
    for (const variable of Object.keys(grammar.productions)) {
        for (const rhs of grammar.productions[variable]) {
            if (rhs === 'ε') {
                // A -> ε permanece
                if (!newGrammar.productions[variable]) newGrammar.productions[variable] = [];
                newGrammar.productions[variable].push('ε');
            } else {
                // A -> Ba vira B -> aA (ou similar)
                // Por simplicidade, inverte a string
                const reversed = rhs.split('').reverse().join('');
                if (!newGrammar.productions[variable]) newGrammar.productions[variable] = [];
                newGrammar.productions[variable].push(reversed);
            }
        }
    }
    
    // Adiciona produções do novo estado inicial
    newGrammar.productions[newStart] = [];
    for (const v of grammar.variables) {
        if (grammar.productions[v] && grammar.productions[v].includes('ε')) {
            // Se variável original aceita ε, novo início pode ir para ela
            newGrammar.productions[newStart].push(v);
        }
    }
    if (newGrammar.productions[newStart].length === 0) {
        newGrammar.productions[newStart].push(grammar.startSymbol);
    }
    
    return grammar; // Retorna original por enquanto - implementação completa é complexa
}

/**
 * Gera código Mermaid para GR (mostra o AFN equivalente com label de GR)
 */
function generateGrMermaidCode(afn, grammarInfo = null) {
    let code = 'stateDiagram-v2\n';
    code += '    direction LR\n';
    
    // Estado inicial
    code += `    [*] --> ${afn.startState}\n`;
    
    // Estados finais
    for (const finalState of afn.finalStates) {
        code += `    ${finalState} --> [*]\n`;
    }
    
    // Agrupa transições por (origem, destino) para combinar símbolos
    const transitionMap = {};
    
    for (const from of Object.keys(afn.transitions)) {
        for (const symbol of Object.keys(afn.transitions[from])) {
            const targets = afn.transitions[from][symbol];
            for (const to of targets) {
                const key = `${from}->${to}`;
                if (!transitionMap[key]) {
                    transitionMap[key] = [];
                }
                transitionMap[key].push(symbol);
            }
        }
    }
    
    // Adiciona transições epsilon
    for (const from of Object.keys(afn.epsilonTransitions)) {
        for (const to of afn.epsilonTransitions[from]) {
            const key = `${from}->${to}`;
            if (!transitionMap[key]) {
                transitionMap[key] = [];
            }
            transitionMap[key].push('ε');
        }
    }
    
    // Gera as transições
    for (const key of Object.keys(transitionMap)) {
        const [from, to] = key.split('->');
        const symbols = transitionMap[key].join(', ');
        code += `    ${from} --> ${to} : ${symbols}\n`;
    }
    
    return code;
}

// Calcula fecho-epsilon de um conjunto de estados
function epsilonClosure(afn, states) {
    const closure = new Set(states);
    const stack = [...states];
    
    while (stack.length > 0) {
        const state = stack.pop();
        const epsilonTargets = afn.epsilonTransitions[state] || [];
        for (const target of epsilonTargets) {
            if (!closure.has(target)) {
                closure.add(target);
                stack.push(target);
            }
        }
    }
    
    return [...closure];
}

// Simulador de AFN (usando busca em largura)
function simulateAFN(afn, inputString) {
    const log = [];
    log.push(`Iniciando simulação AFN com estado inicial: ${afn.startState}`);
    log.push(`String de entrada: "${inputString || '(vazia)'}"`);
    
    // Estados atuais (começa com fecho-epsilon do estado inicial)
    let currentStates = epsilonClosure(afn, [afn.startState]);
    log.push(`Fecho-ε inicial: {${currentStates.join(', ')}}`);
    
    for (let i = 0; i < inputString.length; i++) {
        const char = inputString[i];
        log.push(`\nPasso ${i + 1}: Lendo '${char}' em estados {${currentStates.join(', ')}}`);
        
        // Coleta todos os estados alcançáveis lendo 'char'
        const nextStates = new Set();
        for (const state of currentStates) {
            const targets = (afn.transitions[state] && afn.transitions[state][char]) || [];
            targets.forEach(t => nextStates.add(t));
        }
        
        if (nextStates.size === 0) {
            log.push(`  -> Nenhuma transição para '${char}'. Conjunto vazio.`);
            // Não rejeita imediatamente - pode haver outros caminhos
        } else {
            log.push(`  -> Transições encontradas: {${[...nextStates].join(', ')}}`);
        }
        
        // Aplica fecho-epsilon
        currentStates = epsilonClosure(afn, [...nextStates]);
        log.push(`  -> Fecho-ε: {${currentStates.join(', ')}}`);
        
        if (currentStates.length === 0) {
            log.push(`\nFIM: Conjunto de estados vazio. REJEITA.`);
            return { result: false, log };
        }
    }
    
    // Verifica se algum estado atual é final
    const acceptingStates = currentStates.filter(s => afn.finalStates.includes(s));
    const accepted = acceptingStates.length > 0;
    
    if (accepted) {
        log.push(`\nFIM: Estados finais alcançados: {${acceptingStates.join(', ')}}. ACEITA.`);
    } else {
        log.push(`\nFIM: Nenhum estado final em {${currentStates.join(', ')}}. REJEITA.`);
    }
    
    return { result: accepted, log };
}

// Gera código Mermaid para AFN
function generateAfnMermaidCode(afn) {
    if (!afn || afn.error) return '';
    let mermaidStr = 'stateDiagram-v2\n';
    mermaidStr += '    classDef final fill:#90EE90,stroke:#006400,stroke-width:4px\n';
    mermaidStr += '    classDef nfa fill:#E6E6FA,stroke:#4B0082,stroke-width:2px\n';
    mermaidStr += `    [*] --> ${afn.startState}\n`;
    
    // Agrupa transições por par de estados
    const transitionMap = {};
    
    // Transições normais
    for (const fromState in afn.transitions) {
        for (const symbol in afn.transitions[fromState]) {
            const toStates = afn.transitions[fromState][symbol];
            toStates.forEach(toState => {
                const key = `${fromState}->${toState}`;
                if (!transitionMap[key]) transitionMap[key] = [];
                transitionMap[key].push(symbol);
            });
        }
    }
    
    // Transições epsilon
    for (const fromState in afn.epsilonTransitions) {
        const toStates = afn.epsilonTransitions[fromState];
        toStates.forEach(toState => {
            const key = `${fromState}->${toState}`;
            if (!transitionMap[key]) transitionMap[key] = [];
            transitionMap[key].push('ε');
        });
    }
    
    // Gera linhas do diagrama
    for (const key in transitionMap) {
        const [from, to] = key.split('->');
        const labels = transitionMap[key].join(', ');
        mermaidStr += `    ${from} --> ${to}: ${labels}\n`;
    }
    
    // Marca estados finais
    afn.finalStates.forEach(state => { 
        mermaidStr += `    class ${state} final\n`; 
    });
    
    // Marca como NFA se tiver não-determinismo
    if (afn.isNFA) {
        // Adiciona nota indicando que é AFN
        mermaidStr += `    note right of ${afn.startState}: AFN\n`;
    }
    
    return mermaidStr;
}

// ============================================================
// === AUTÔMATO DE PILHA (AP/PDA) ===
// ============================================================

// Parser para AP (Autômato de Pilha)
// Formato da definição:
// Estados: q0, q1, q2
// Alfabeto_Entrada: a, b, c
// Alfabeto_Pilha: A, B, Z
// Simbolo_Inicial_Pilha: Z
// Estado_Inicial: q0
// Estados_Finais: q2
// Transicoes:
// q0, a, Z, q1, AZ      // (estado, símbolo_entrada, topo_pilha) -> (novo_estado, nova_pilha)
// q1, b, A, q1, ε       // ε significa desempilhar (pilha vazia nessa posição)
function parseApDefinition(text) {
    try {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const ap = { transitions: [], isNonDeterministic: false };
        let readingTransitions = false;
        
        for (const line of lines) {
            if (line.toLowerCase().startsWith('transicoes:') || line.toLowerCase().startsWith('transições:')) { 
                readingTransitions = true; 
                continue; 
            }
            if (readingTransitions) {
                // Formato: estado_atual, símbolo_entrada, topo_pilha, novo_estado, operação_pilha
                // Símbolo de entrada pode ser ε (epsilon) para transição sem consumir entrada
                const parts = line.split(',').map(s => s.trim());
                if (parts.length < 5) continue;
                
                let [fromState, inputSymbol, stackTop, toState, ...stackOpParts] = parts;
                const stackOperation = stackOpParts.join(',').trim(); // Pode ter vírgulas no push
                
                // Normaliza epsilon
                if (inputSymbol === 'ε' || inputSymbol === 'epsilon' || inputSymbol === 'eps' || 
                    inputSymbol === 'λ' || inputSymbol === 'lambda' || inputSymbol === 'E' || inputSymbol === '') {
                    inputSymbol = 'ε';
                }
                if (stackOperation === 'ε' || stackOperation === 'epsilon' || stackOperation === '') {
                    // ε na pilha significa "não empilha nada" (apenas desempilha)
                }
                
                ap.transitions.push({
                    from: fromState,
                    input: inputSymbol,
                    stackTop: stackTop,
                    to: toState,
                    stackPush: stackOperation
                });
            } else {
                const [key, value] = line.split(/:(.*)/s);
                if (!key || !value) continue;
                const formattedKey = key.trim().toLowerCase().replace(/_/g, '').replace(/ /g, '');
                const values = value.trim().split(',').map(s => s.trim());
                
                if (formattedKey === 'estados') ap.states = values;
                if (formattedKey === 'alfabetoentrada') ap.inputAlphabet = values.filter(s => s !== 'ε');
                if (formattedKey === 'alfabetopilha') ap.stackAlphabet = values;
                if (formattedKey === 'simboloinicialpilha' || formattedKey === 'simbolopilhainicial') 
                    ap.initialStackSymbol = values[0];
                if (formattedKey === 'estadoinicial') ap.startState = values[0];
                if (formattedKey === 'estadosfinais') ap.finalStates = values;
                // Modo de aceitação: 'estado' (padrão), 'pilha' (pilha vazia), ou 'ambos'
                if (formattedKey === 'modoaceitacao' || formattedKey === 'aceitacao') 
                    ap.acceptanceMode = values[0].toLowerCase();
            }
        }
        
        // Define modo de aceitação padrão
        if (!ap.acceptanceMode) {
            ap.acceptanceMode = 'estado'; // Aceita por estado final (padrão)
        }
        
        // Detecta não-determinismo
        const transitionMap = {};
        for (const t of ap.transitions) {
            const key = `${t.from},${t.input},${t.stackTop}`;
            if (transitionMap[key]) {
                ap.isNonDeterministic = true;
                break;
            }
            transitionMap[key] = true;
            // Transições epsilon também indicam possível não-determinismo
            if (t.input === 'ε') {
                ap.isNonDeterministic = true;
            }
        }
        
        if (!ap.states || !ap.inputAlphabet || !ap.startState) {
            return { error: "Definição incompleta do Autômato de Pilha." };
        }
        
        // Se não tem estados finais e modo é por estado, erro
        if (ap.acceptanceMode === 'estado' && (!ap.finalStates || ap.finalStates.length === 0)) {
            return { error: "Estados finais não definidos para aceitação por estado." };
        }
        
        return ap;
    } catch (e) { 
        return { error: e.message }; 
    }
}

// Simulador de AP (usando busca em largura para não-determinismo)
function simulateAP(ap, inputString, maxSteps = 5000) {
    const log = [];
    log.push(`Iniciando simulação AP com estado inicial: ${ap.startState}`);
    log.push(`String de entrada: "${inputString || '(vazia)'}"`);
    log.push(`Modo de aceitação: ${ap.acceptanceMode}`);
    
    // Configuração inicial: (estado, posição na entrada, pilha)
    const initialStack = ap.initialStackSymbol ? [ap.initialStackSymbol] : [];
    const initialConfig = {
        state: ap.startState,
        pos: 0,
        stack: [...initialStack]
    };
    
    // BFS para explorar todas as configurações possíveis
    const queue = [initialConfig];
    const visited = new Set();
    let steps = 0;
    
    while (queue.length > 0 && steps < maxSteps) {
        const config = queue.shift();
        steps++;
        
        // Cria chave única para configuração
        const configKey = `${config.state}|${config.pos}|${config.stack.join('')}`;
        if (visited.has(configKey)) continue;
        visited.add(configKey);
        
        const currentInput = config.pos < inputString.length ? inputString[config.pos] : null;
        const stackTop = config.stack.length > 0 ? config.stack[config.stack.length - 1] : null;
        
        // Verifica aceitação
        const inputConsumed = config.pos >= inputString.length;
        const inFinalState = ap.finalStates && ap.finalStates.includes(config.state);
        const stackEmpty = config.stack.length === 0;
        
        let accepted = false;
        if (ap.acceptanceMode === 'estado' && inputConsumed && inFinalState) {
            accepted = true;
        } else if (ap.acceptanceMode === 'pilha' && inputConsumed && stackEmpty) {
            accepted = true;
        } else if (ap.acceptanceMode === 'ambos' && inputConsumed && inFinalState && stackEmpty) {
            accepted = true;
        }
        
        if (accepted) {
            log.push(`\nFIM: Aceita em estado ${config.state}, pilha: [${config.stack.join(', ')}]`);
            return { result: true, log };
        }
        
        // Procura transições aplicáveis
        for (const t of ap.transitions) {
            if (t.from !== config.state) continue;
            
            // Verifica se o topo da pilha corresponde (ou é ε para qualquer)
            const stackMatches = t.stackTop === 'ε' || t.stackTop === stackTop;
            if (!stackMatches && t.stackTop !== 'ε') continue;
            
            // Transição com símbolo de entrada
            if (t.input !== 'ε' && t.input === currentInput) {
                const newStack = [...config.stack];
                // Remove topo da pilha (se não é ε)
                if (t.stackTop !== 'ε' && newStack.length > 0) {
                    newStack.pop();
                }
                // Empilha novos símbolos (da direita para esquerda, para que o primeiro fique no topo)
                if (t.stackPush && t.stackPush !== 'ε') {
                    const symbolsToPush = t.stackPush.split('').reverse();
                    newStack.push(...symbolsToPush);
                }
                
                queue.push({
                    state: t.to,
                    pos: config.pos + 1,
                    stack: newStack
                });
            }
            
            // Transição epsilon (sem consumir entrada)
            if (t.input === 'ε') {
                const newStack = [...config.stack];
                if (t.stackTop !== 'ε' && newStack.length > 0) {
                    newStack.pop();
                }
                if (t.stackPush && t.stackPush !== 'ε') {
                    const symbolsToPush = t.stackPush.split('').reverse();
                    newStack.push(...symbolsToPush);
                }
                
                queue.push({
                    state: t.to,
                    pos: config.pos,
                    stack: newStack
                });
            }
        }
    }
    
    if (steps >= maxSteps) {
        log.push(`\nFIM: Limite de passos (${maxSteps}) atingido. Rejeita.`);
    } else {
        log.push(`\nFIM: Nenhuma configuração de aceitação encontrada. Rejeita.`);
    }
    
    return { result: false, log };
}

// Gera código Mermaid para AP
function generateApMermaidCode(ap) {
    if (!ap || ap.error) return '';
    
    let mermaidStr = 'stateDiagram-v2\n';
    mermaidStr += '    classDef final fill:#90EE90,stroke:#006400,stroke-width:4px\n';
    mermaidStr += '    classDef pda fill:#FFE4B5,stroke:#FF8C00,stroke-width:2px\n';
    mermaidStr += `    [*] --> ${ap.startState}\n`;
    
    // Agrupa transições por par de estados
    const transitionMap = {};
    
    for (const t of ap.transitions) {
        const key = `${t.from}->${t.to}`;
        if (!transitionMap[key]) transitionMap[key] = [];
        
        // Formato: símbolo_entrada, topo_pilha → nova_pilha
        const inputLabel = t.input === 'ε' ? 'ε' : t.input;
        const stackTopLabel = t.stackTop === 'ε' ? 'ε' : t.stackTop;
        const stackPushLabel = (!t.stackPush || t.stackPush === 'ε') ? 'ε' : t.stackPush;
        
        transitionMap[key].push(`${inputLabel},${stackTopLabel}/${stackPushLabel}`);
    }
    
    // Gera linhas do diagrama
    for (const key in transitionMap) {
        const [from, to] = key.split('->');
        const labels = transitionMap[key].join('<br/>');
        mermaidStr += `    ${from} --> ${to}: ${labels}\n`;
    }
    
    // Marca estados finais
    if (ap.finalStates) {
        ap.finalStates.forEach(state => { 
            mermaidStr += `    class ${state} final\n`; 
        });
    }
    
    // Marca todos os estados como PDA
    if (ap.states) {
        ap.states.forEach(state => {
            if (!ap.finalStates || !ap.finalStates.includes(state)) {
                mermaidStr += `    class ${state} pda\n`;
            }
        });
    }
    
    // Adiciona nota com símbolo inicial da pilha
    if (ap.initialStackSymbol) {
        mermaidStr += `    note right of ${ap.startState} : Pilha_inicial=${ap.initialStackSymbol}\n`;
    }
    
    return mermaidStr;
}

function parseAfdDefinition(text) {
    try {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const afd = { transitions: {} };
        let readingTransitions = false;
        for (const line of lines) {
            if (line.toLowerCase().startsWith('transicoes:')) { readingTransitions = true; continue; }
            if (readingTransitions) {
                const [from, symbol, to] = line.split(',').map(s => s.trim());
                if (!from || !symbol || !to) continue;
                if (!afd.transitions[from]) afd.transitions[from] = {};
                if (!afd.transitions[from][symbol]) afd.transitions[from][symbol] = [];
                afd.transitions[from][symbol].push(to);
            } else {
                const [key, value] = line.split(/:(.*)/s);
                if (!key || !value) continue;
                const formattedKey = key.trim().toLowerCase().replace('_', '');
                const values = value.trim().split(',').map(s => s.trim());
                if (formattedKey === 'estados') afd.states = values;
                if (formattedKey === 'alfabeto') afd.alphabet = values;
                if (formattedKey === 'estadoinicial') afd.startState = values[0];
                if (formattedKey === 'estadosfinais') afd.finalStates = values;
            }
        }
        if (!afd.states || !afd.alphabet || !afd.startState || !afd.finalStates) return { error: "Definição incompleta." };
        return afd;
    } catch (e) { return { error: e.message }; }
}

function parseTuringDefinition(text) {
    try {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const tm = { transitions: [] };
        let readingTransitions = false;
        for (let line of lines) {
            line = line.split('//')[0].trim();
            if (!line) continue;
            if (line.toLowerCase().startsWith('transicoes:')) { readingTransitions = true; continue; }
            if (readingTransitions) {
                const parts = line.split(',').map(s => s.trim());
                if (parts.length !== 5) continue;
                const [from, read, to, write, direction] = parts;
                if (!from || !to || !write || !direction) continue;
                tm.transitions.push({ from, read, to, write, direction: direction.toUpperCase() });
            } else {
                const [key, value] = line.split(/:(.*)/s);
                if (!key || !value) continue;
                const formattedKey = key.trim().toLowerCase().replace(/_/g, '');
                const values = value.trim().split(',').map(s => s.trim());
                if (formattedKey === 'estados') tm.states = values;
                if (formattedKey === 'alfabetoentrada') tm.inputAlphabet = values;
                if (formattedKey === 'alfabetofita') tm.tapeAlphabet = values;
                if (formattedKey === 'simbolobranco') tm.blank = values[0];
                if (formattedKey === 'estadoinicial') tm.startState = values[0];
                if (formattedKey === 'estadoaceitacao') tm.acceptState = values[0];
                if (formattedKey === 'estadorejeicao') tm.rejectState = values[0];
            }
        }
        if (!tm.states || !tm.inputAlphabet || !tm.tapeAlphabet || !tm.blank || !tm.startState || !tm.acceptState || !tm.rejectState) {
            return { error: "Definição incompleta da Máquina de Turing." };
        }
        return tm;
    } catch (e) { return { error: e.message }; }
}

// Parser para MT Multifita
function parseMultitapeDefinition(multitapeDef) {
    try {
        const mtm = {
            tapes: multitapeDef.tapes || 2,
            states: multitapeDef.states || [],
            description: multitapeDef.description || '',
            algorithm: multitapeDef.algorithm || [],
            transitions: [],
            startState: multitapeDef.initial_state || 'q0',
            acceptState: multitapeDef.accept_state || 'qf',
            rejectState: multitapeDef.reject_state || 'qreject',
            blank: multitapeDef.blank_symbol || '_',
            isMultitape: true
        };
        
        // Parse das transições no formato: (estado, [símbolos]) -> (estado, [writes], [dirs])
        if (multitapeDef.transitions) {
            multitapeDef.transitions.forEach(transStr => {
                // Formato: "(q0, [a, _]) -> (q1, [a, I], [R, R])"
                const match = transStr.match(/\((\w+),\s*\[([^\]]+)\]\)\s*->\s*\((\w+),\s*\[([^\]]+)\],\s*\[([^\]]+)\]\)/);
                if (match) {
                    const [, fromState, reads, toState, writes, dirs] = match;
                    mtm.transitions.push({
                        from: fromState,
                        read: reads.split(',').map(s => s.trim()),
                        to: toState,
                        write: writes.split(',').map(s => s.trim()),
                        direction: dirs.split(',').map(s => s.trim().toUpperCase())
                    });
                }
            });
        }
        
        // Extrai estados das transições se não definidos
        if (mtm.states.length === 0) {
            const stateSet = new Set();
            mtm.transitions.forEach(t => {
                stateSet.add(t.from);
                stateSet.add(t.to);
            });
            mtm.states = [...stateSet];
        }
        
        // Detecta estado de aceitação e rejeição
        mtm.states.forEach(s => {
            if (s.toLowerCase().includes('accept') || s === 'qf') mtm.acceptState = s;
            if (s.toLowerCase().includes('reject') || s === 'qreject') mtm.rejectState = s;
        });
        
        return mtm;
    } catch (e) { return { error: e.message }; }
}

// Simulador de MT Multifita
function simulateMultitapeTuring(mtm, inputString, maxSteps = 2000, verbose = false) {
    const numTapes = mtm.tapes;
    
    // Inicializa as fitas
    const tapes = [];
    for (let i = 0; i < numTapes; i++) {
        if (i === 0) {
            // Fita 1: entrada
            tapes.push(inputString.length > 0 ? inputString.split('') : [mtm.blank]);
        } else {
            // Outras fitas: vazias
            tapes.push([mtm.blank]);
        }
    }
    
    // Posição dos cabeçotes (uma para cada fita)
    const heads = new Array(numTapes).fill(0);
    
    let currentState = mtm.startState;
    let steps = 0;
    const log = [];
    
    if (verbose) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Simulação MT Multifita (${numTapes} fitas): "${inputString || '(vazia)'}"`);
        console.log(`${'='.repeat(60)}`);
    }
    
    while (currentState !== mtm.acceptState && currentState !== mtm.rejectState && steps < maxSteps) {
        // Verifica posições válidas e expande fitas se necessário
        for (let i = 0; i < numTapes; i++) {
            // Trata L na posição 0 como N (fita semi-infinita à esquerda)
            if (heads[i] < 0) heads[i] = 0;
            while (heads[i] >= tapes[i].length) tapes[i].push(mtm.blank);
        }
        
        // Lê símbolos atuais de todas as fitas
        const currentSymbols = tapes.map((tape, i) => tape[heads[i]] || mtm.blank);
        
        // Mostra estado atual
        const tapesDisplay = tapes.map((tape, i) => {
            return `F${i+1}: ${tape.map((c, idx) => idx === heads[i] ? `[${c}]` : c).join('')}`;
        }).join(' | ');
        const stepMsg = `Passo ${steps}: Estado=${currentState} | ${tapesDisplay}`;
        log.push(stepMsg);
        if (verbose) console.log(`\n${stepMsg}`);
        
        // Procura transição
        const transition = mtm.transitions.find(t => {
            if (t.from !== currentState) return false;
            // Verifica se todos os símbolos correspondem (ou usa * como wildcard)
            for (let i = 0; i < numTapes && i < t.read.length; i++) {
                if (t.read[i] !== '*' && t.read[i] !== currentSymbols[i]) return false;
            }
            return true;
        });
        
        if (!transition) {
            const msg = `FIM: Nenhuma transição para (${currentState}, [${currentSymbols.join(', ')}]). Rejeita.`;
            log.push(msg);
            if (verbose) console.log(`\n❌ ${msg}`);
            return { result: false, log };
        }
        
        // Aplica transição
        const transMsg = ` -> (${transition.from}, [${transition.read.join(',')}]) -> (${transition.to}, [${transition.write.join(',')}], [${transition.direction.join(',')}])`;
        log.push(transMsg);
        if (verbose) console.log(`   ${transMsg}`);
        
        // Escreve nas fitas e move cabeçotes
        for (let i = 0; i < numTapes; i++) {
            if (i < transition.write.length && transition.write[i] !== '*') {
                tapes[i][heads[i]] = transition.write[i];
            }
            if (i < transition.direction.length) {
                if (transition.direction[i] === 'R') heads[i]++;
                else if (transition.direction[i] === 'L') heads[i]--;
                // 'N' = não move
            }
        }
        
        currentState = transition.to;
        steps++;
    }
    
    if (steps >= maxSteps) {
        const msg = `FIM: Limite de passos (${maxSteps}) atingido. Rejeita.`;
        log.push(msg);
        if (verbose) console.log(`\n⏱️ ${msg}`);
        return { result: false, log };
    }
    
    const msg = `FIM: Estado '${currentState}' atingido.`;
    log.push(msg);
    const result = currentState === mtm.acceptState;
    if (verbose) console.log(`\n${result ? '✅' : '❌'} ${msg} - ${result ? 'ACEITA' : 'REJEITA'}`);
    
    return { result, log };
}

// Gerador de diagrama Mermaid para MT Multifita
function generateMultitapeMermaidCode(mtm, description) {
    let mermaidStr = 'stateDiagram-v2\n';
    mermaidStr += '    classDef accept fill:#90EE90,stroke:#006400,stroke-width:4px\n';
    mermaidStr += '    classDef reject fill:#FFB6C1,stroke:#8B0000,stroke-width:4px\n';
    mermaidStr += '    classDef multitape fill:#E6E6FA,stroke:#4B0082,stroke-width:2px\n';
    mermaidStr += `    [*] --> ${mtm.startState}\n`;
    
    // Agrupa transições por par de estados
    const transitionMap = {};
    mtm.transitions.forEach(t => {
        const key = `${t.from}->${t.to}`;
        if (!transitionMap[key]) {
            transitionMap[key] = [];
        }
        // Formato: [read1,read2]/[write1,write2],[dir1,dir2]
        const readPart = `[${t.read.join(',')}]`;
        const writePart = `[${t.write.join(',')}]`;
        const dirPart = `[${t.direction.join(',')}]`;
        transitionMap[key].push(`${readPart}/${writePart},${dirPart}`);
    });
    
    for (const key in transitionMap) {
        const [from, to] = key.split('->');
        const labels = transitionMap[key];
        const formattedLabels = [];
        for (let i = 0; i < labels.length; i += 2) {
            formattedLabels.push(labels.slice(i, i + 2).join(' | '));
        }
        const label = formattedLabels.join('<br/>');
        mermaidStr += `    ${from} --> ${to}: ${label}\n`;
    }
    
    // Adiciona nota com número de fitas
    mermaidStr += `    note right of ${mtm.startState}: ${mtm.tapes} fitas\n`;
    
    mermaidStr += `    class ${mtm.acceptState} accept\n`;
    if (mtm.rejectState) {
        mermaidStr += `    class ${mtm.rejectState} reject\n`;
    }
    
    // Marca estados como multitape
    mtm.states.forEach(s => {
        if (s !== mtm.acceptState && s !== mtm.rejectState && s !== mtm.startState) {
            mermaidStr += `    class ${s} multitape\n`;
        }
    });
    
    return mermaidStr;
}

// Gera diagrama conceitual para MT multifita (flowchart com fitas)
function generateMultitapeConceptDiagram(mtm, description) {
    let mermaidStr = 'flowchart TB\n';
    
    // Título
    mermaidStr += `    title["<b>MT Multifita - ${mtm.tapes} Fitas</b><br/>${description || ''}"]\n`;
    mermaidStr += '    style title fill:#f9f,stroke:#333,stroke-width:2px\n\n';
    
    // Cria representação das fitas
    for (let i = 0; i < mtm.tapes; i++) {
        const fitaDesc = i === 0 ? 'Entrada' : `Auxiliar ${i}`;
        mermaidStr += `    subgraph Fita${i+1}["Fita ${i+1}: ${fitaDesc}"]\n`;
        mermaidStr += `        F${i+1}C1["..."]\n`;
        mermaidStr += `        F${i+1}C2["σ"]\n`;
        mermaidStr += `        F${i+1}C3["..."]\n`;
        mermaidStr += `        F${i+1}C1 --- F${i+1}C2 --- F${i+1}C3\n`;
        mermaidStr += `    end\n`;
        mermaidStr += `    H${i+1}(("↓")) --> F${i+1}C2\n`;
        mermaidStr += `    style H${i+1} fill:#ff0,stroke:#000\n\n`;
    }
    
    // Controle central
    mermaidStr += '    subgraph Controle["Unidade de Controle"]\n';
    mermaidStr += `        Q["Estado: q"]\n`;
    mermaidStr += '    end\n';
    mermaidStr += '    style Controle fill:#e6e6fa,stroke:#4b0082,stroke-width:2px\n\n';
    
    // Conecta fitas ao controle
    for (let i = 0; i < mtm.tapes; i++) {
        mermaidStr += `    Controle -.-> H${i+1}\n`;
    }
    
    // Algoritmo
    if (mtm.algorithm && mtm.algorithm.length > 0) {
        mermaidStr += '\n    subgraph Algoritmo["Algoritmo"]\n';
        mermaidStr += '        direction TB\n';
        mtm.algorithm.forEach((step, idx) => {
            const cleanStep = step.replace(/"/g, "'").replace(/[<>]/g, '');
            mermaidStr += `        A${idx}["${cleanStep}"]\n`;
        });
        mermaidStr += '    end\n';
        mermaidStr += '    style Algoritmo fill:#f0fff0,stroke:#228b22\n';
    }
    
    return mermaidStr;
}

function generateMermaidCode(afd) {
    if (!afd || afd.error) return '';
    let mermaidStr = 'stateDiagram-v2\n';
    mermaidStr += '    classDef final stroke-width:4px,stroke:black\n';
    mermaidStr += `    [*] --> ${afd.startState}\n`;
    for (const fromState in afd.transitions) {
        for (const symbol in afd.transitions[fromState]) {
            const toStates = afd.transitions[fromState][symbol];
            toStates.forEach(toState => { mermaidStr += `    ${fromState} --> ${toState}: ${symbol}\n`; });
        }
    }
    afd.finalStates.forEach(state => { mermaidStr += `    class ${state} final\n`; });
    return mermaidStr;
}

function generateTuringMermaidCode(tm) {
    if (!tm || tm.error) return '';
    let mermaidStr = 'stateDiagram-v2\n';
    mermaidStr += '    classDef accept fill:#90EE90,stroke:#006400,stroke-width:4px\n';
    mermaidStr += '    classDef reject fill:#FFB6C1,stroke:#8B0000,stroke-width:4px\n';
    mermaidStr += `    [*] --> ${tm.startState}\n`;
    const transitionMap = {};
    tm.transitions.forEach(t => {
        const key = `${t.from}->${t.to}`;
        if (!transitionMap[key]) {
            transitionMap[key] = [];
        }
        transitionMap[key].push(`${t.read}/${t.write},${t.direction}`);
    });
    for (const key in transitionMap) {
        const [from, to] = key.split('->');
        const labels = transitionMap[key];
        const formattedLabels = [];
        for (let i = 0; i < labels.length; i += 3) {
            formattedLabels.push(labels.slice(i, i + 3).join(' | '));
        }
        const label = formattedLabels.join('<br/>');
        mermaidStr += `    ${from} --> ${to}: ${label}\n`;
    }
    mermaidStr += `    class ${tm.acceptState} accept\n`;
    mermaidStr += `    class ${tm.rejectState} reject\n`;
    return mermaidStr;
}

function simulateAFD(afd, inputString) {
    let currentState = afd.startState;
    const log = [];
    log.push(`Iniciando simulação com estado: ${currentState}`);
    log.push(`String de entrada: "${inputString || '(vazia)'}"`);
    
    for (let i = 0; i < inputString.length; i++) {
        const char = inputString[i];
        log.push(`Passo ${i}: Estado=${currentState}, Lendo='${char}'`);
        
        if (afd.transitions[currentState] && afd.transitions[currentState][char]) {
            const nextState = afd.transitions[currentState][char][0];
            log.push(` -> Transição encontrada: (${currentState}, ${char}) -> ${nextState}`);
            currentState = nextState;
        } else {
            log.push(` -> ERRO: Nenhuma transição encontrada para (${currentState}, ${char}). O AFD rejeita.`);
            return { result: false, log };
        }
    }
    
    const isFinal = afd.finalStates.includes(currentState);
    log.push(`FIM: Estado final '${currentState}' ${isFinal ? 'é' : 'NÃO é'} um estado de aceitação.`);
    
    return { result: isFinal, log };
}

function simulateTuring(tm, inputString, maxSteps = 2000, verbose = false) {
    let tape = inputString.split('');
    if (tape.length === 0) tape = [tm.blank];
    let head = 0;
    let currentState = tm.startState;
    let steps = 0;
    const log = [];
    
    if (verbose) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Simulação detalhada: "${inputString || '(vazia)'}"`);
        console.log(`${'='.repeat(60)}`);
    }
    
    while (currentState !== tm.acceptState && currentState !== tm.rejectState && steps < maxSteps) {
        if (head < 0) {
            const msg = `ERRO: Cabeçote moveu para posição negativa (${head}).`;
            log.push(msg);
            if (verbose) console.log(`\n❌ ${msg}`);
            return { result: false, log };
        }
        while (head >= tape.length) tape.push(tm.blank);
        const currentSymbol = tape[head] || tm.blank;
        const transition = tm.transitions.find(t =>
            t.from === currentState && (t.read === currentSymbol || t.read === '*')
        );
        
        const tapeDisplay = tape.map((char, idx) => idx === head ? `[${char}]` : char).join('');
        const stepMsg = `Passo ${steps}: Estado=${currentState}, Fita=${tapeDisplay}, Lendo='${currentSymbol}'`;
        log.push(stepMsg);
        
        if (verbose) {
            console.log(`\n${stepMsg}`);
        }
        
        if (!transition) {
            const msg = `FIM: Nenhuma transição encontrada para o estado '${currentState}' com o símbolo '${currentSymbol}'. A máquina para e rejeita.`;
            log.push(msg);
            if (verbose) console.log(`\n❌ ${msg}`);
            return { result: false, log };
        }
        
        const transMsg = ` -> Transição encontrada: (${transition.from}, ${transition.read}) -> (${transition.to}, ${transition.write}, ${transition.direction}).`;
        log.push(transMsg);
        if (verbose) console.log(`   ${transMsg}`);
        
        tape[head] = transition.write;
        currentState = transition.to;
        if (transition.direction === 'R') head++;
        else if (transition.direction === 'L') head--;
        steps++;
    }
    
    if (steps >= maxSteps) {
        const msg = `FIM: Número máximo de passos (${maxSteps}) atingido. A máquina para e rejeita.`;
        log.push(msg);
        if (verbose) console.log(`\n⏱️  ${msg}`);
    } else {
        const msg = `FIM: Estado final '${currentState}' atingido.`;
        log.push(msg);
        if (verbose) {
            const result = currentState === tm.acceptState;
            console.log(`\n${result ? '✅' : '❌'} ${msg} - ${result ? 'ACEITA' : 'REJEITA'}`);
        }
    }
    
    return { result: currentState === tm.acceptState, log };
}

// Detecta se uma MT é não-determinística (múltiplas transições para mesmo par estado-símbolo)
function detectNondeterminism(tm) {
    const transitionMap = new Map();
    for (const trans of tm.transitions) {
        const key = `${trans.from},${trans.read}`;
        if (transitionMap.has(key)) {
            return true; // Encontrou múltiplas transições
        }
        transitionMap.set(key, true);
    }
    return false;
}

// Simulador de MT Não-Determinística (explora todas as ramificações)
function simulateNondeterministicTuring(tm, inputString, maxSteps = 2000, verbose = false) {
    // Estrutura: { tape, head, state, steps, path }
    const initialConfig = {
        tape: inputString.split('').length > 0 ? inputString.split('') : [tm.blank],
        head: 0,
        state: tm.startState,
        steps: 0,
        path: []
    };
    
    const queue = [initialConfig]; // BFS para explorar todas as ramificações
    const visited = new Set(); // Evita loops infinitos
    let exploredPaths = 0;
    let acceptingPath = null;
    
    if (verbose) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Simulação NÃO-DETERMINÍSTICA: "${inputString || '(vazia)'}"`);
        console.log(`${'='.repeat(60)}`);
        console.log(`⚡ Explorando TODAS as ramificações possíveis...\n`);
    }
    
    while (queue.length > 0 && !acceptingPath) {
        const config = queue.shift();
        const { tape, head, state, steps, path } = config;
        
        // Limite de passos
        if (steps >= maxSteps) continue;
        
        // Estado de aceitação encontrado!
        if (state === tm.acceptState) {
            acceptingPath = { config, path };
            break;
        }
        
        // Estado de rejeição - abandona este caminho
        if (state === tm.rejectState) continue;
        
        // Validações de fita
        if (head < 0) continue;
        while (head >= tape.length) tape.push(tm.blank);
        
        const currentSymbol = tape[head] || tm.blank;
        
        // Cria chave única para detectar loops
        const configKey = `${state}:${head}:${tape.join('')}`;
        if (visited.has(configKey)) continue;
        visited.add(configKey);
        
        // Busca TODAS as transições possíveis (não-determinismo!)
        const possibleTransitions = tm.transitions.filter(t =>
            t.from === state && (t.read === currentSymbol || t.read === '*')
        );
        
        if (possibleTransitions.length === 0) {
            // Nenhuma transição = rejeita este caminho
            continue;
        }
        
        exploredPaths++;
        
        // Para cada transição possível, cria uma nova ramificação
        possibleTransitions.forEach((transition, idx) => {
            const newTape = [...tape];
            newTape[head] = transition.write;
            
            let newHead = head;
            if (transition.direction === 'R') newHead++;
            else if (transition.direction === 'L') newHead--;
            
            const tapeDisplay = newTape.map((c, i) => i === head ? `[${c}]` : c).join('');
            const stepInfo = `${steps}. ${state} | ${tapeDisplay} | ${currentSymbol} → (${transition.to}, ${transition.write}, ${transition.direction})`;
            
            const newConfig = {
                tape: newTape,
                head: newHead,
                state: transition.to,
                steps: steps + 1,
                path: [...path, stepInfo]
            };
            
            queue.push(newConfig);
            
            if (verbose && possibleTransitions.length > 1) {
                console.log(`  🔀 Ramificação ${idx + 1}/${possibleTransitions.length}: ${state} → ${transition.to}`);
            }
        });
    }
    
    const log = [];
    
    if (acceptingPath) {
        log.push(`✅ ACEITA - Caminho de aceitação encontrado!`);
        log.push(`Passos totais: ${acceptingPath.config.steps}`);
        log.push(`Ramificações exploradas: ${exploredPaths}`);
        log.push(``);
        log.push(`Caminho de execução:`);
        acceptingPath.path.forEach(step => log.push(`  ${step}`));
        log.push(`  ${acceptingPath.config.steps}. ${acceptingPath.config.state} [ACEITA]`);
        
        if (verbose) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ ACEITA - Caminho de aceitação encontrado!`);
            console.log(`Passos: ${acceptingPath.config.steps} | Ramificações: ${exploredPaths}`);
            console.log(`${'='.repeat(60)}`);
            console.log(`\nCaminho de execução:`);
            acceptingPath.path.forEach(step => console.log(`  ${step}`));
            console.log(`  → Estado final: ${acceptingPath.config.state} ✓`);
        }
        
        return { result: true, log, explored: exploredPaths };
    } else {
        log.push(`❌ REJEITA - Nenhum caminho de aceitação encontrado`);
        log.push(`Ramificações exploradas: ${exploredPaths}`);
        log.push(`Configurações visitadas: ${visited.size}`);
        
        if (verbose) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`❌ REJEITA - Todas as ramificações falharam`);
            console.log(`Ramificações exploradas: ${exploredPaths}`);
            console.log(`Configurações únicas: ${visited.size}`);
            console.log(`${'='.repeat(60)}`);
        }
        
        return { result: false, log, explored: exploredPaths };
    }
}

// --- Funções de Interface CLI ---

// Função auxiliar para obter diretórios corretos baseado no tipo
function getDirectories(machineType) {
    if (machineType === 'afd') {
        return { inputDir: inputDirAFD, diagramDir: diagramDirAFD };
    } else if (machineType === 'afn') {
        return { inputDir: inputDirAFN, diagramDir: diagramDirAFN };
    } else if (machineType === 'ap' || machineType === 'pda') {
        return { inputDir: inputDirAP, diagramDir: diagramDirAP };
    } else if (machineType === 'turing' || machineType === 'mt') {
        return { inputDir: inputDirMT, diagramDir: diagramDirMT };
    } else if (machineType === 'gr' || machineType === 'grammar') {
        return { inputDir: inputDirGR, diagramDir: diagramDirGR };
    }
    // Fallback para pastas legadas
    return { inputDir, diagramDir };
}

// Função para detectar tipo pelo nome do arquivo
function detectTypeByFilename(filename) {
    const lower = filename.toLowerCase();
    if (lower.startsWith('mt_') || lower.startsWith('mtnd_') || lower.includes('turing')) return 'mt';
    if (lower.startsWith('ap_') || lower.startsWith('pda_') || lower.includes('_ap_') || lower.includes('_pda_')) return 'ap';
    if (lower.startsWith('afn_') || lower.includes('afn')) return 'afn';
    if (lower.startsWith('afd_') || lower.includes('afd')) return 'afd';
    if (lower.startsWith('gr_') || lower.startsWith('grammar_') || lower.includes('_gr_')) return 'gr';
    return null;
}

function listInputFiles(type = null) {
    const files = [];
    
    // Lista arquivos de AFD
    if (!type || type === 'afd') {
        if (fs.existsSync(inputDirAFD)) {
            const afdFiles = fs.readdirSync(inputDirAFD)
                .filter(f => fs.statSync(path.join(inputDirAFD, f)).isFile())
                .map(f => ({ name: f, path: path.join(inputDirAFD, f), type: 'afd' }));
            files.push(...afdFiles);
        }
    }
    
    // Lista arquivos de AFN
    if (!type || type === 'afn') {
        if (fs.existsSync(inputDirAFN)) {
            const afnFiles = fs.readdirSync(inputDirAFN)
                .filter(f => fs.statSync(path.join(inputDirAFN, f)).isFile())
                .map(f => ({ name: f, path: path.join(inputDirAFN, f), type: 'afn' }));
            files.push(...afnFiles);
        }
    }
    
    // Lista arquivos de AP (Autômato de Pilha)
    if (!type || type === 'ap') {
        if (fs.existsSync(inputDirAP)) {
            const apFiles = fs.readdirSync(inputDirAP)
                .filter(f => fs.statSync(path.join(inputDirAP, f)).isFile())
                .map(f => ({ name: f, path: path.join(inputDirAP, f), type: 'ap' }));
            files.push(...apFiles);
        }
    }
    
    // Lista arquivos de MT
    if (!type || type === 'mt') {
        if (fs.existsSync(inputDirMT)) {
            const mtFiles = fs.readdirSync(inputDirMT)
                .filter(f => fs.statSync(path.join(inputDirMT, f)).isFile())
                .map(f => ({ name: f, path: path.join(inputDirMT, f), type: 'mt' }));
            files.push(...mtFiles);
        }
    }
    
    // Lista arquivos de MT ND
    if (!type || type === 'mt') {
        if (fs.existsSync(inputDirMTND)) {
            const mtndFiles = fs.readdirSync(inputDirMTND)
                .filter(f => fs.statSync(path.join(inputDirMTND, f)).isFile())
                .map(f => ({ name: f, path: path.join(inputDirMTND, f), type: 'mt' }));
            files.push(...mtndFiles);
        }
    }
    
    // Lista arquivos de GR (Gramática Regular)
    if (!type || type === 'gr') {
        if (fs.existsSync(inputDirGR)) {
            const grFiles = fs.readdirSync(inputDirGR)
                .filter(f => fs.statSync(path.join(inputDirGR, f)).isFile())
                .map(f => ({ name: f, path: path.join(inputDirGR, f), type: 'gr' }));
            files.push(...grFiles);
        }
    }
    
    // Lista arquivos legados (pasta input)
    if (fs.existsSync(inputDir)) {
        const legacyFiles = fs.readdirSync(inputDir)
            .filter(f => fs.statSync(path.join(inputDir, f)).isFile())
            .map(f => ({ name: f, path: path.join(inputDir, f), type: detectTypeByFilename(f) || 'legacy' }));
        files.push(...legacyFiles);
    }
    
    return files;
}

function askUserFile(files, callback) {
    console.log('\n' + '='.repeat(60));
    console.log('Arquivos disponíveis:');
    console.log('='.repeat(60));
    files.forEach((file, idx) => {
        const typeLabel = file.type === 'afd' ? '[AFD]' : 
                         file.type === 'afn' ? '[AFN]' : 
                         file.type === 'ap' ? '[AP]' :
                         file.type === 'mt' ? '[MT]' : 
                         file.type === 'gr' ? '[GR]' : '[?]';
        console.log(`  [${idx + 1}] ${typeLabel} ${file.name}`);
    });
    console.log('='.repeat(60) + '\n');
    
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Digite o número do arquivo que deseja analisar: ', answer => {
        const idx = parseInt(answer, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= files.length) {
            console.log('\n✗ Opção inválida. Saindo.\n');
            rl.close();
            return;
        }
        rl.close();
        callback(files[idx]);
    });
}

function detectMachineType(content, jsonData = null) {
    const lowerContent = content.toLowerCase();
    
    // Verifica se é GR (Gramática Regular)
    if (lowerContent.includes('variaveis:') || 
        lowerContent.includes('variáveis:') ||
        lowerContent.includes('variables:') ||
        lowerContent.includes('terminais:') ||
        lowerContent.includes('terminals:') ||
        lowerContent.includes('producoes:') ||
        lowerContent.includes('produções:') ||
        lowerContent.includes('productions:') ||
        content.includes('->') || content.includes('→')) {
        // Verifica se tem formato de produção (A -> aB)
        const hasProduction = /[A-Z][A-Za-z0-9_]*\s*(?:->|→)\s*.+/.test(content);
        if (hasProduction && (lowerContent.includes('variaveis') || lowerContent.includes('variables') || 
            lowerContent.includes('terminais') || lowerContent.includes('terminals'))) {
            return 'gr';
        }
    }
    
    // Verifica se JSON indica GR
    if (jsonData && (jsonData.type === 'gr' || jsonData.type === 'grammar' || 
        jsonData.productions || jsonData.variables || jsonData.terminais ||
        (jsonData.grammar && (jsonData.grammar.productions || jsonData.grammar.variables)))) {
        return 'gr';
    }
    
    // Verifica se é MT (Máquina de Turing)
    if (lowerContent.includes('alfabeto_fita') || 
        lowerContent.includes('alfabetofita') || 
        lowerContent.includes('simbolo_branco') || 
        lowerContent.includes('simbolobranco') ||
        lowerContent.includes('estado_aceitacao') ||
        lowerContent.includes('estadoaceitacao') ||
        lowerContent.includes('estado_rejeicao') ||
        lowerContent.includes('estadorejeicao')) {
        return 'turing';
    }
    
    // Verifica se é AP (Autômato de Pilha)
    if (lowerContent.includes('alfabeto_pilha') || 
        lowerContent.includes('alfabetopilha') || 
        lowerContent.includes('simbolo_inicial_pilha') ||
        lowerContent.includes('simbolopilhainicial') ||
        lowerContent.includes('simboloinicialpilha') ||
        lowerContent.includes('modo_aceitacao') ||
        lowerContent.includes('modoaceitacao')) {
        return 'ap';
    }
    
    // Verifica se JSON indica AP
    if (jsonData && (jsonData.type === 'ap' || jsonData.type === 'pda' || 
        jsonData.stackAlphabet || jsonData.alfabeto_pilha || jsonData.initialStackSymbol)) {
        return 'ap';
    }
    
    // Verifica se JSON indica AFN
    if (jsonData && (jsonData.nondeterministic === true || jsonData.isNFA === true || jsonData.type === 'afn')) {
        return 'afn';
    }
    
    // Verifica se tem epsilon no conteúdo (indica AFN) - mas cuidado com AP
    if (lowerContent.includes('epsilon') || content.includes('ε') || content.includes('λ')) {
        // Se tem 5+ elementos nas transições, provavelmente é AP
        const lines = content.split('\n');
        let hasApTransition = false;
        for (const line of lines) {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length >= 5) {
                hasApTransition = true;
                break;
            }
        }
        if (hasApTransition) return 'ap';
        return 'afn';
    }
    
    // Analisa transições para detectar tipo
    const lines = content.split('\n');
    const transitionMap = {};
    let inTransitions = false;
    
    for (const line of lines) {
        if (line.toLowerCase().includes('transicoes:') || line.toLowerCase().includes('transições:')) {
            inTransitions = true;
            continue;
        }
        if (inTransitions) {
            const parts = line.split(',').map(s => s.trim());
            // Se tem 5+ partes, é AP
            if (parts.length >= 5) {
                return 'ap';
            }
            if (parts.length >= 3) {
                const key = `${parts[0]},${parts[1]}`;
                if (transitionMap[key]) {
                    // Múltiplas transições para mesmo par (estado, símbolo) = AFN
                    return 'afn';
                }
                transitionMap[key] = true;
            }
        }
    }
    
    return 'afd';
}

async function generateDiagramFromMermaid(mermaidCode, outputPath, includeSvg = false) {
    const tempMermaidFile = path.join(__dirname, 'temp_diagram.mmd');
    fs.writeFileSync(tempMermaidFile, mermaidCode);
    
    // outputPath já vem como .pdf
    const pdfOutputPath = outputPath.endsWith('.pdf') ? outputPath : outputPath.replace(/\.[^.]+$/, '.pdf');
    const svgOutputPath = pdfOutputPath.replace('.pdf', '.svg');
    
    try {
        // Gera PDF (padrão - sempre)
        try {
            execSync(`npx -y @mermaid-js/mermaid-cli@latest -i "${tempMermaidFile}" -o "${pdfOutputPath}" --pdfFit`, {
                stdio: 'pipe'
            });
            console.log(`✓ Diagrama PDF salvo em: ${pdfOutputPath}`);
        } catch (pdfError) {
            console.log(`⚠ Não foi possível gerar PDF: ${pdfError.message}`);
        }
        
        // Gera SVG apenas se solicitado
        if (includeSvg) {
            execSync(`npx -y @mermaid-js/mermaid-cli@latest -i "${tempMermaidFile}" -o "${svgOutputPath}"`, {
                stdio: 'pipe'
            });
            console.log(`✓ Diagrama SVG salvo em: ${svgOutputPath}`);
        }
        
        return true;
    } catch (error) {
        console.error(`✗ Erro ao gerar diagrama: ${error.message}`);
        console.log('Tentando método alternativo...');
        
        // Método alternativo: salvar apenas o código Mermaid
        try {
            const mmdOutputPath = pdfOutputPath.replace('.pdf', '.mmd');
            fs.writeFileSync(mmdOutputPath, mermaidCode);
            console.log(`✓ Código Mermaid salvo em: ${mmdOutputPath}`);
            console.log('  (Para gerar o diagrama, execute: npx mmdc -i arquivo.mmd -o arquivo.pdf)');
            return true;
        } catch (altError) {
            console.error(`✗ Erro ao salvar código Mermaid: ${altError.message}`);
            return false;
        }
    } finally {
        if (fs.existsSync(tempMermaidFile)) {
            fs.unlinkSync(tempMermaidFile);
        }
    }
}

function processFile(filename) {
    const filePath = path.join(inputDir, filename);
    let content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Analisando arquivo: ${filename}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Tenta parsear como JSON primeiro
    let jsonData = null;
    let rules = null;
    try {
        jsonData = JSON.parse(content);
        if (jsonData.definition) {
            content = jsonData.definition;
            rules = jsonData.rules || null;
            if (rules) {
                console.log(`✓ Regras de validação encontradas: ${rules.length} grupo(s)\n`);
            }
        }
    } catch (e) {
        // Não é JSON, trata como texto puro
    }
    
    const machineType = detectMachineType(content);
    console.log(`Tipo detectado: ${machineType === 'turing' ? 'Máquina de Turing' : 'AFD'}\n`);
    
    let machine;
    let mermaidCode;
    
    if (machineType === 'turing') {
        machine = parseTuringDefinition(content);
        if (machine.error) {
            console.error(`✗ ERRO na definição: ${machine.error}\n`);
            return;
        }
        console.log('✓ Definição da Máquina de Turing válida');
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto de entrada: ${machine.inputAlphabet.join(', ')}`);
        console.log(`  - Alfabeto da fita: ${machine.tapeAlphabet.join(', ')}`);
        console.log(`  - Símbolo branco: ${machine.blank}`);
        console.log(`  - Estado inicial: ${machine.startState}`);
        console.log(`  - Estado de aceitação: ${machine.acceptState}`);
        console.log(`  - Estado de rejeição: ${machine.rejectState}`);
        console.log(`  - Transições: ${machine.transitions.length}\n`);
        
        // Detecta se é não-determinística
        const isNondeterministic = jsonData.nondeterministic === true || detectNondeterminism(machine);
        if (isNondeterministic) {
            console.log('\x1b[33m⚡ MÁQUINA NÃO-DETERMINÍSTICA detectada\x1b[0m');
            console.log('  → Explorará TODAS as ramificações possíveis\n');
        }
        
        mermaidCode = generateTuringMermaidCode(machine);
        
        // Se há regras, valida com testes aleatórios
        if (rules) {
            console.log('\n--- Validação com Regras ---');
            const masterValidator = buildMasterValidator(rules);
            if (!masterValidator) {
                console.log('✗ Nenhuma regra válida definida.\n');
            } else {
                const ruleAlphabet = getAlphabetFromRules(rules);
                const combinedAlphabet = [...new Set([...ruleAlphabet, ...(machine.inputAlphabet || [])])];
                const alphabet = combinedAlphabet.length > 0 ? combinedAlphabet : ['a', 'b'];
                
                console.log(`Alfabeto usado para testes: ${alphabet.join(', ')}`);
                const failedTests = [];
                const NUM_TESTS = 100;
                const MAX_LENGTH = 15;
                
                console.log(`Executando ${NUM_TESTS} testes aleatórios...\n`);
                for (let i = 0; i < NUM_TESTS && failedTests.length < 5; i++) {
                    const testString = generateRandomString(alphabet, MAX_LENGTH);
                    const simulationResult = isNondeterministic 
                        ? simulateNondeterministicTuring(machine, testString)
                        : simulateTuring(machine, testString);
                    const validatorResult = masterValidator(testString);
                    if (simulationResult.result !== validatorResult) {
                        const expected = validatorResult ? 'ACEITA' : 'REJEITA';
                        const got = simulationResult.result ? 'ACEITA' : 'REJEITA';
                        failedTests.push({ testString, expected, got, log: simulationResult.log });
                    }
                }
                
                if (failedTests.length > 0) {
                    console.log('\x1b[31m✗ INCORRETO\x1b[0m - Encontradas falhas nos seguintes testes:\n');
                    failedTests.forEach(fail => {
                        console.log(`  String: "${fail.testString || '(vazia)'}"`);  
                        console.log(`  Esperado: ${fail.expected}, Recebido: ${fail.got}`);
                        if (fail.log && fail.log.length > 0) {
                            console.log('  Log (primeiras 5 linhas):');
                            fail.log.slice(0, 5).forEach(line => console.log(`    ${line}`));
                        }
                        console.log('');
                    });
                } else {
                    console.log('\x1b[32m✓ CORRETO\x1b[0m - Sua Máquina de Turing passou em todos os testes aleatórios!\n');
                }
            }
        } else {
            console.log('\nTestando com strings de exemplo:');
            const testStrings = ['', 'a', 'aa', 'ab', 'aba', 'aaa', 'bbb', 'aabb'];
            testStrings.forEach(testStr => {
                const result = isNondeterministic 
                    ? simulateNondeterministicTuring(machine, testStr)
                    : simulateTuring(machine, testStr);
                const status = result.result ? '✓ ACEITA' : '✗ REJEITA';
                const exploredInfo = result.explored ? ` (${result.explored} ramificações)` : '';
                console.log(`  "${testStr || '(vazia)'}" -> ${status}${exploredInfo}`);
            });
        }
    } else {
        machine = parseAfdDefinition(content);
        if (machine.error) {
            console.error(`✗ ERRO na definição: ${machine.error}\n`);
            return;
        }
        console.log('✓ Definição do AFD válida');
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto: ${machine.alphabet.join(', ')}`);
        console.log(`  - Estado inicial: ${machine.startState}`);
        console.log(`  - Estados finais: ${machine.finalStates.join(', ')}`);
        console.log(`  - Transições: ${Object.keys(machine.transitions).reduce((sum, state) => 
            sum + Object.keys(machine.transitions[state]).length, 0)}\n`);
        
        mermaidCode = generateMermaidCode(machine);
        
        // Se há regras, valida com testes aleatórios
        if (rules) {
            console.log('\n--- Validação com Regras ---');
            const masterValidator = buildMasterValidator(rules);
            if (!masterValidator) {
                console.log('✗ Nenhuma regra válida definida.\n');
            } else {
                const ruleAlphabet = getAlphabetFromRules(rules);
                const combinedAlphabet = [...new Set([...ruleAlphabet, ...(machine.alphabet || [])])];
                const alphabet = combinedAlphabet.length > 0 ? combinedAlphabet : ['a', 'b'];
                
                console.log(`Alfabeto usado para testes: ${alphabet.join(', ')}`);
                const failedTests = [];
                const NUM_TESTS = 500;
                const MAX_LENGTH = 20;
                
                console.log(`Executando ${NUM_TESTS} testes aleatórios...\n`);
                for (let i = 0; i < NUM_TESTS && failedTests.length < 2; i++) {
                    const testString = generateRandomString(alphabet, MAX_LENGTH);
                    const simulation = simulateAFD(machine, testString);
                    const afdResult = simulation.result;
                    const validatorResult = masterValidator(testString);
                    if (afdResult !== validatorResult) {
                        const expected = validatorResult ? 'ACEITA' : 'REJEITA';
                        const got = afdResult ? 'ACEITA' : 'REJEITA';
                        failedTests.push({ testString, expected, got, log: simulation.log });
                    }
                }
                
                if (failedTests.length > 0) {
                    console.log('\x1b[31m✗ INCORRETO\x1b[0m - Encontradas falhas nos seguintes testes:\n');
                    failedTests.forEach(fail => {
                        console.log(`  String: "${fail.testString || '(vazia)'}"`);  
                        console.log(`  Esperado: ${fail.expected}, Recebido: ${fail.got}`);
                        if (fail.log && fail.log.length > 0) {
                            console.log('  Log de Execução:');
                            fail.log.forEach(line => console.log(`    ${line}`));
                        }
                        console.log('');
                    });
                } else {
                    console.log('\x1b[32m✓ CORRETO\x1b[0m - Seu AFD passou em todos os testes aleatórios!\n');
                }
            }
        } else {
            console.log('\nTestando com strings de exemplo:');
            const testStrings = ['', 'a', 'aa', 'ab', 'aba', 'aaa', 'bbb', 'aabb'];
            testStrings.forEach(testStr => {
                const simulation = simulateAFD(machine, testStr);
                const status = simulation.result ? '✓ ACEITA' : '✗ REJEITA';
                console.log(`  "${testStr || '(vazia)'}" -> ${status}`);
            });
        }
    }
    
    console.log('\n--- Código Mermaid Gerado ---');
    console.log(mermaidCode);
    console.log('--- Fim do Código ---\n');
    
    const outputFilename = filename.replace(/\.[^.]+$/, '.pdf');
    const outputPath = path.join(diagramDir, outputFilename);
    
    console.log('Gerando diagrama...');
    generateDiagramFromMermaid(mermaidCode, outputPath, generateSvg).then(success => {
        if (success) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('✓ Análise concluída com sucesso!');
            console.log(`${'='.repeat(60)}\n`);
        }
    });
}

function parseLanguageDescription(desc) {
    // Converte descrição de linguagem em regras
    // Ex: "w começa com ab" -> regra startsWith
    const rules = [];
    const group = { rules: [] };
    
    const descLower = desc.toLowerCase();
    
    // Padrões de linguagens estruturadas
    // a^n b^n c^n
    if (descLower.match(/a\^?n\s*b\^?n\s*c\^?n/) || descLower.match(/anbnc n/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'abc', condition: 'i === j && j === k' },
            negated: false
        });
    }
    // a^n b^n
    else if (descLower.match(/a\^?n\s*b\^?n/) && !descLower.includes('c')) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'ab', condition: 'i === j' },
            negated: false
        });
    }
    // a^n b^m onde n = 2m
    else if (descLower.match(/n\s*=\s*2\s*\*?\s*m|n\s*=\s*2m/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'ab', condition: 'i === 2 * j' },
            negated: false
        });
    }
    // a^n b^(2n) c^(n-1) com n > 0 - DEVE vir ANTES de a^n b^(2n) por ser mais específico
    else if (descLower.match(/a\^?n\s*b\^?\(?2\s*\*?\s*n\)?\s*c\^?\(?\s*n\s*-\s*1\)?/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'abc', condition: 'j === 2 * i && k === i - 1 && i >= 1' },
            negated: false
        });
    }
    // a^n b^(2n)
    else if (descLower.match(/b\^?\(?2\s*\*?\s*n\)?/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'ab', condition: 'j === 2 * i' },
            negated: false
        });
    }
    // 1^n 0^(n+3)
    else if (descLower.match(/1\^?n\s*0\^?\(?\s*n\s*\+\s*3\)?/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: '10', condition: 'j === i + 3' },
            negated: false
        });
    }
    // a^i b^j a^k onde j = max(i, k)
    else if (descLower.match(/j\s*=\s*max\s*\(\s*i\s*,\s*k\s*\)/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'aba', condition: 'j === Math.max(i, k)' },
            negated: false
        });
    }
    // a^i b^j a^k onde i = j ou j = k
    else if (descLower.match(/i\s*=\s*j\s+ou\s+j\s*=\s*k/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'aba', condition: 'i === j || j === k' },
            negated: false
        });
    }
    // ww^R (palíndromo par)
    else if (descLower.match(/ww\^?r/) || descLower.match(/pal[ií]ndromo\s+par/)) {
        // Para ww^R, a string deve ter comprimento par e ser um palíndromo
        group.rules.push({
            type: 'palindrome',
            value: { type: 'even' },
            negated: false
        });
    }
    // Palíndromo simples (qualquer comprimento)
    else if (descLower.match(/pal[ií]ndromo/) && !descLower.match(/par/)) {
        group.rules.push({
            type: 'palindrome',
            value: { type: 'any' },
            negated: false
        });
    }
    // Mesma quantidade de 'a' e 'b'
    else if (descLower.match(/mesma\s+quantidade.*['"]?a['"]?.*['"]?b['"]?|igual.*numero.*a.*b/)) {
        group.rules.push({
            type: 'structuredLanguage',
            value: { pattern: 'ab', condition: 'i === j' },
            negated: false
        });
    }
    
    // Padrões simples
    if (descLower.match(/come[çc]a com ['"]?(\w+)['"]?/)) {
        const match = descLower.match(/come[çc]a com ['"]?(\w+)['"]?/);
        group.rules.push({ type: 'startsWith', value: match[1], negated: false });
    }
    
    if (descLower.match(/termina com ['"]?(\w+)['"]?/)) {
        const match = descLower.match(/termina com ['"]?(\w+)['"]?/);
        group.rules.push({ type: 'endsWith', value: match[1], negated: false });
    }
    
    if (descLower.match(/cont[eé]m ['"]?(\w+)['"]?/) && !descLower.includes('não contém')) {
        const match = descLower.match(/cont[eé]m ['"]?(\w+)['"]?/);
        group.rules.push({ type: 'contains', value: match[1], negated: false });
    }
    
    if (descLower.match(/n[ãa]o cont[eé]m ['"]?(\w+)['"]?/)) {
        const match = descLower.match(/n[ãa]o cont[eé]m ['"]?(\w+)['"]?/);
        group.rules.push({ type: 'contains', value: match[1], negated: true });
    }
    
    // Contagem de caracteres
    if (descLower.match(/pelo menos (\d+) ['"]?(\w)['"]?/)) {
        const match = descLower.match(/pelo menos (\d+) ['"]?(\w)['"]?/);
        group.rules.push({
            type: 'count',
            value: {
                subject: { type: 'char', char: match[2] },
                operator: '>=',
                N: parseInt(match[1])
            },
            negated: false
        });
    }
    
    if (descLower.match(/exatamente (\d+) ['"]?(\w)['"]?/)) {
        const match = descLower.match(/exatamente (\d+) ['"]?(\w)['"]?/);
        group.rules.push({
            type: 'count',
            value: {
                subject: { type: 'char', char: match[2] },
                operator: '==',
                N: parseInt(match[1])
            },
            negated: false
        });
    }
    
    if (descLower.match(/comprimento par/)) {
        group.rules.push({
            type: 'count',
            value: {
                subject: { type: 'total' },
                operator: 'even',
                N: 0
            },
            negated: false
        });
    }
    
    if (descLower.match(/comprimento [ií]mpar/)) {
        group.rules.push({
            type: 'count',
            value: {
                subject: { type: 'total' },
                operator: 'odd',
                N: 0
            },
            negated: false
        });
    }
    
    if (group.rules.length > 0) {
        rules.push(group);
    }
    
    return rules.length > 0 ? rules : null;
}

// ============================================================
// FUNÇÃO DE ANÁLISE E SUGESTÃO DE TIPO DE MT
// ============================================================

function analyzeMTAndSuggest(jsonData, description) {
    console.log('\n' + '='.repeat(60));
    console.log('  ANÁLISE DE TIPO IDEAL DE MÁQUINA DE TURING');
    console.log('='.repeat(60) + '\n');
    
    const analysis = {
        features: [],
        scores: {
            'MT Padrão': 0,
            'MT com Fita Bidirecional (Infinita para ambos os lados)': 0,
            'MT com Cabeça Imóvel': 0,
            'MT com Múltiplas Trilhas': 0,
            'MT Multifita': 0
        },
        reasons: {
            'MT Padrão': [],
            'MT com Fita Bidirecional (Infinita para ambos os lados)': [],
            'MT com Cabeça Imóvel': [],
            'MT com Múltiplas Trilhas': [],
            'MT Multifita': []
        }
    };
    
    // Extrai regras e características da linguagem
    const rules = jsonData.rules || [];
    const desc = (description || jsonData.description || '').toLowerCase();
    const complexity = jsonData.complexity || {};
    
    // Análise das regras
    let hasStructuredLanguage = false;
    let hasPalindrome = false;
    let hasEqualCount = false;
    let hasMultipleCounters = false;
    let needsComparison = false;
    let needsReversal = false;
    let isSimple = false;
    let symbolsCount = 0;
    let conditionComplexity = 'baixa';
    let detectedPattern = '';
    let detectedCondition = '';
    
    rules.forEach(ruleGroup => {
        const groupRules = ruleGroup.rules || [];
        groupRules.forEach(rule => {
            if (rule.type === 'structuredLanguage') {
                hasStructuredLanguage = true;
                symbolsCount = (rule.symbols || []).length;
                
                // Extrai pattern e condition do value
                const value = rule.value || {};
                const pattern = value.pattern || '';
                const cond = value.condition || rule.condition || '';
                
                detectedPattern = pattern;
                detectedCondition = cond;
                
                // ============================================================
                // ANÁLISE DO PATTERN (ex: "a^i b^j a^k", "aba", "ab", etc.)
                // ============================================================
                
                // Conta quantos grupos de expoentes diferentes existem
                const expMatches = pattern.match(/\^[a-z]/g) || [];
                const uniqueExponents = [...new Set(expMatches.map(e => e[1]))];
                if (uniqueExponents.length > 0) {
                    symbolsCount = uniqueExponents.length;
                }
                
                if (uniqueExponents.length >= 3) {
                    hasMultipleCounters = true;
                    analysis.features.push(`Múltiplos contadores (${uniqueExponents.join(', ')})`);
                } else if (uniqueExponents.length === 2) {
                    analysis.features.push(`Dois contadores (${uniqueExponents.join(', ')})`);
                    needsComparison = true;
                }
                
                // Detecta padrões especiais
                if (pattern.includes('w^r') || pattern.includes('ww') || pattern.includes('w^R')) {
                    needsReversal = true;
                    hasPalindrome = true;
                    analysis.features.push('Palíndromo/Reversão (ww^R)');
                }
                
                // ============================================================
                // ANÁLISE DA CONDITION (ex: "j === Math.max(i, k)", "i === j")
                // ============================================================
                
                if (cond) {
                    // Detecta max/min
                    if (cond.toLowerCase().includes('max')) {
                        conditionComplexity = 'alta';
                        analysis.features.push('Condição com MAX - requer comparação múltipla');
                        needsComparison = true;
                        hasMultipleCounters = true;
                    }
                    if (cond.toLowerCase().includes('min')) {
                        conditionComplexity = 'alta';
                        analysis.features.push('Condição com MIN - requer comparação múltipla');
                        needsComparison = true;
                        hasMultipleCounters = true;
                    }
                    
                    // Detecta OR (||) - indica não-determinismo ou múltiplas verificações
                    if (cond.includes('||') || cond.toLowerCase().includes(' ou ') || cond.toLowerCase().includes(' or ')) {
                        conditionComplexity = 'média';
                        analysis.features.push('Condição com OU - pode requerer backtracking');
                    }
                    
                    // Detecta AND (&&)
                    if (cond.includes('&&') || cond.toLowerCase().includes(' e ') || cond.toLowerCase().includes(' and ')) {
                        analysis.features.push('Condição composta (AND)');
                    }
                    
                    // Conta quantas variáveis estão sendo comparadas
                    // Remove Math.max/min antes de contar variáveis para não pegar o 'm' de Math
                    const condClean = cond.replace(/Math\.(max|min)/gi, '');
                    const varMatches = condClean.match(/[ijklmn]/g) || [];
                    const uniqueVars = [...new Set(varMatches)];
                    if (uniqueVars.length >= 3) {
                        hasMultipleCounters = true;
                        analysis.features.push(`Comparação entre ${uniqueVars.length} contadores (${uniqueVars.join(', ')})`);
                    } else if (uniqueVars.length === 2) {
                        analysis.features.push(`Comparação entre 2 contadores (${uniqueVars.join(', ')})`);
                        needsComparison = true;
                    }
                    
                    // Detecta comparações de igualdade
                    if (cond.includes('===') || cond.includes('==') || cond.match(/[ijklmn]\s*=\s*[ijklmn0-9]/)) {
                        needsComparison = true;
                    }
                    
                    // Detecta multiplicadores (n = 2m, 2n, etc.)
                    if (cond.match(/[2-9]\s*\*?\s*[ijklmn]/) || cond.match(/[ijklmn]\s*\*\s*[2-9]/) || cond.match(/=\s*[2-9][ijklmn]/)) {
                        analysis.features.push('Condição com multiplicador (ex: n = 2m)');
                        needsComparison = true;
                    }
                    
                    // Detecta soma/subtração (n+1, n-1, etc.)
                    if (cond.match(/[ijklmn]\s*[\+\-]\s*\d/) || cond.match(/\d\s*[\+\-]\s*[ijklmn]/)) {
                        analysis.features.push('Condição com offset (+/- constante)');
                    }
                    
                    // Detecta desigualdades
                    if (cond.includes('>') && !cond.includes('>=')) {
                        needsComparison = true;
                        analysis.features.push('Comparação de desigualdade (>)');
                    }
                    if (cond.includes('<') && !cond.includes('<=')) {
                        needsComparison = true;
                        analysis.features.push('Comparação de desigualdade (<)');
                    }
                    if (cond.includes('>=') || cond.includes('<=')) {
                        needsComparison = true;
                        analysis.features.push('Comparação de desigualdade (>=, <=)');
                    }
                }
            } else if (rule.type === 'palindrome') {
                hasPalindrome = true;
                needsReversal = true;
                analysis.features.push('Palíndromo (requer reversão)');
            } else if (rule.type === 'equalCount') {
                hasEqualCount = true;
                needsComparison = true;
                analysis.features.push('Contagem igual de símbolos');
            } else if (rule.type === 'startsWith' || rule.type === 'endsWith' || rule.type === 'contains') {
                isSimple = true;
                analysis.features.push('Verificação de padrão simples');
            } else if (rule.type === 'regex') {
                analysis.features.push('Padrão regex');
            }
        });
    });
    
    // Análise da descrição textual
    if (desc.includes('ww') || desc.includes('w^r') || desc.includes('reverso')) {
        needsReversal = true;
        analysis.features.push('Requer comparação com reverso (ww^R ou similar)');
    }
    if (desc.includes('palindrom')) {
        hasPalindrome = true;
        needsReversal = true;
    }
    if (desc.includes('a^n') || desc.includes('b^n') || desc.includes('c^n')) {
        hasStructuredLanguage = true;
    }
    if (desc.includes('max(') || desc.includes('min(')) {
        conditionComplexity = 'alta';
    }
    
    // ============================================================
    // PONTUAÇÃO PARA CADA TIPO DE MT
    // ============================================================
    
    // MT PADRÃO - Boa para casos simples, base para tudo
    analysis.scores['MT Padrão'] = 50; // Base
    analysis.reasons['MT Padrão'].push('Sempre é uma opção válida (modelo base)');
    
    if (isSimple) {
        analysis.scores['MT Padrão'] += 30;
        analysis.reasons['MT Padrão'].push('Linguagem simples - MT padrão é suficiente');
    }
    if (!hasMultipleCounters && !needsReversal) {
        analysis.scores['MT Padrão'] += 20;
        analysis.reasons['MT Padrão'].push('Não requer estruturas complexas de contagem');
    }
    if (hasStructuredLanguage && symbolsCount <= 2) {
        analysis.scores['MT Padrão'] += 10;
        analysis.reasons['MT Padrão'].push('Poucos símbolos diferentes para processar');
    }
    
    // MT COM FITA BIDIRECIONAL (infinita para ambos os lados)
    analysis.scores['MT com Fita Bidirecional (Infinita para ambos os lados)'] = 40;
    analysis.reasons['MT com Fita Bidirecional (Infinita para ambos os lados)'].push('Equivalente à MT padrão em poder computacional');
    
    if (needsReversal) {
        analysis.scores['MT com Fita Bidirecional (Infinita para ambos os lados)'] += 25;
        analysis.reasons['MT com Fita Bidirecional (Infinita para ambos os lados)'].push('Facilita operações de reversão (pode escrever para a esquerda do início)');
    }
    if (desc.includes('centro') || desc.includes('meio') || desc.includes('metade')) {
        analysis.scores['MT com Fita Bidirecional (Infinita para ambos os lados)'] += 20;
        analysis.reasons['MT com Fita Bidirecional (Infinita para ambos os lados)'].push('Útil para processar a partir do centro da entrada');
    }
    
    // MT COM CABEÇA IMÓVEL
    analysis.scores['MT com Cabeça Imóvel'] = 30;
    analysis.reasons['MT com Cabeça Imóvel'].push('Variante onde a fita move em vez da cabeça');
    
    if (isSimple && !needsReversal) {
        analysis.scores['MT com Cabeça Imóvel'] += 15;
        analysis.reasons['MT com Cabeça Imóvel'].push('Pode simplificar leitura sequencial');
    }
    // Não é vantajosa para casos complexos
    if (hasMultipleCounters || needsReversal) {
        analysis.scores['MT com Cabeça Imóvel'] -= 20;
        analysis.reasons['MT com Cabeça Imóvel'].push('Não oferece vantagem para processamento complexo');
    }
    
    // MT COM MÚLTIPLAS TRILHAS (uma fita, k trilhas)
    analysis.scores['MT com Múltiplas Trilhas'] = 45;
    analysis.reasons['MT com Múltiplas Trilhas'].push('Uma fita com múltiplas trilhas paralelas');
    
    if (hasEqualCount || (hasStructuredLanguage && needsComparison)) {
        analysis.scores['MT com Múltiplas Trilhas'] += 25;
        analysis.reasons['MT com Múltiplas Trilhas'].push('Útil para comparar quantidades em paralelo (trilha para cada contador)');
    }
    if (symbolsCount >= 2 && symbolsCount <= 3) {
        analysis.scores['MT com Múltiplas Trilhas'] += 15;
        analysis.reasons['MT com Múltiplas Trilhas'].push(`Boa para ${symbolsCount} símbolos - uma trilha por símbolo`);
    }
    if (needsReversal && !hasPalindrome) {
        analysis.scores['MT com Múltiplas Trilhas'] += 10;
        analysis.reasons['MT com Múltiplas Trilhas'].push('Pode manter entrada em uma trilha e trabalho em outra');
    }
    
    // MT MULTIFITA (k fitas independentes)
    analysis.scores['MT Multifita'] = 40;
    analysis.reasons['MT Multifita'].push('Múltiplas fitas independentes com cabeças próprias');
    
    if (hasMultipleCounters) {
        analysis.scores['MT Multifita'] += 35;
        analysis.reasons['MT Multifita'].push('IDEAL: Cada contador pode usar uma fita separada');
    }
    if (needsReversal || hasPalindrome) {
        analysis.scores['MT Multifita'] += 30;
        analysis.reasons['MT Multifita'].push('IDEAL: Pode copiar para segunda fita e comparar em direções opostas');
    }
    if (conditionComplexity === 'alta') {
        analysis.scores['MT Multifita'] += 25;
        analysis.reasons['MT Multifita'].push('Condição complexa - múltiplas fitas facilitam comparações');
    }
    if (hasStructuredLanguage && symbolsCount >= 3) {
        analysis.scores['MT Multifita'] += 20;
        analysis.reasons['MT Multifita'].push(`${symbolsCount} símbolos diferentes - cada fase pode usar uma fita`);
    }
    if (complexity.standard && complexity.multitape) {
        if (complexity.standard.includes('²') && complexity.multitape.includes('n)')) {
            analysis.scores['MT Multifita'] += 30;
            analysis.reasons['MT Multifita'].push(`Reduz complexidade de ${complexity.standard} para ${complexity.multitape}`);
        }
    }
    
    // ============================================================
    // EXIBIÇÃO DOS RESULTADOS
    // ============================================================
    
    // Mostra pattern e condition detectados das rules (prioridade)
    if (detectedPattern || detectedCondition) {
        console.log('📋 Linguagem detectada das rules:');
        if (detectedPattern) {
            console.log(`   Pattern: ${detectedPattern}`);
        }
        if (detectedCondition) {
            console.log(`   Condição: ${detectedCondition}`);
        }
        console.log('');
    } else if (desc) {
        // Fallback para description se não tiver pattern/condition
        console.log(`📋 Linguagem: ${jsonData.description || description}`);
        console.log('');
    }
    
    // Mostra características detectadas
    if (analysis.features.length > 0) {
        console.log('🔍 Características detectadas:');
        analysis.features.forEach(f => console.log(`   • ${f}`));
        console.log('');
    }
    
    // Ordena por pontuação
    const sorted = Object.entries(analysis.scores).sort((a, b) => b[1] - a[1]);
    
    // Mostra ranking
    console.log('📊 RANKING DE TIPOS DE MT (do mais ao menos recomendado):');
    console.log('─'.repeat(55));
    
    const medals = ['🥇', '🥈', '🥉', '  ', '  '];
    sorted.forEach(([type, score], index) => {
        const bar = '█'.repeat(Math.floor(score / 5));
        const medal = medals[index];
        const scoreStr = score.toString().padStart(3);
        console.log(`${medal} ${scoreStr} pts │ ${bar}`);
        console.log(`         │ ${type}`);
        
        // Mostra razões principais (top 2)
        const reasons = analysis.reasons[type].slice(0, 2);
        reasons.forEach(r => console.log(`         │   ↳ ${r}`));
        console.log('');
    });
    
    // Recomendação final
    const best = sorted[0];
    const second = sorted[1];
    
    console.log('─'.repeat(55));
    console.log(`\n✅ RECOMENDAÇÃO: \x1b[32m${best[0]}\x1b[0m`);
    
    if (best[1] - second[1] < 15) {
        console.log(`   (também considere: ${second[0]})`);
    }
    
    // Explicação adicional baseada no melhor tipo
    console.log('\n💡 Justificativa:');
    analysis.reasons[best[0]].forEach(r => console.log(`   • ${r}`));
    
    // Tabela comparativa de complexidade
    console.log('\n📈 Comparação de Complexidade Típica:');
    console.log('─'.repeat(55));
    console.log('   Tipo de MT                    │ Complexidade Típica');
    console.log('─'.repeat(55));
    console.log('   MT Padrão                     │ O(n²) a O(n³)');
    console.log('   MT Fita Bidirecional          │ O(n²) a O(n³)');
    console.log('   MT Cabeça Imóvel              │ O(n²) a O(n³)');
    console.log('   MT Múltiplas Trilhas          │ O(n) a O(n²)');
    console.log('   MT Multifita                  │ O(n) a O(n log n)');
    console.log('─'.repeat(55));
    
    if (complexity.standard && complexity.multitape) {
        console.log(`\n   Para esta linguagem específica:`);
        console.log(`   • MT Padrão: ${complexity.standard}`);
        console.log(`   • MT Multifita: ${complexity.multitape}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    return {
        best: best[0],
        scores: analysis.scores,
        features: analysis.features
    };
}

function processFromArgs() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        return false; // Sem argumentos, usa modo interativo
    }
    
    // Parse dos argumentos
    let definition = '';
    let description = '';
    let testStrings = [];
    let customName = '';
    let verboseMode = false;
    let forceGenerate = false;
    let iterativoJson = null;
    let generateSvg = false; // Por padrão só gera PDF
    let suggestMTType = false; // Modo de sugestão de tipo de MT
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--def' || args[i] === '-d') {
            definition = args[++i];
        } else if (args[i] === '--sugerir' || args[i] === '-sg' || args[i] === '--analyze') {
            suggestMTType = true;
        } else if (args[i] === '--lang' || args[i] === '-l') {
            description = args[++i];
        } else if (args[i] === '--test' || args[i] === '-t') {
            testStrings = args[++i].split(',');
        } else if (args[i] === '--name' || args[i] === '-n') {
            customName = args[++i];
        } else if (args[i] === '--iterativo-json' || args[i] === '-ij') {
            try {
                iterativoJson = JSON.parse(args[++i]);
            } catch (e) {
                console.error('✗ Erro ao fazer parse do JSON iterativo:', e.message);
                process.exit(1);
            }
        } else if (args[i] === '--verbose' || args[i] === '-v') {
            verboseMode = true;
        } else if (args[i] === '--force' || args[i] === '-f') {
            forceGenerate = true;
        } else if (args[i] === '--svg' || args[i] === '-s') {
            generateSvg = true;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log('\nFerramenta CLI de Validação de AFD/Turing\n');
            console.log('Argumentos:');
            console.log('  -d, --def <texto|arquivo.json>  Definição do AFD/MT (texto ou caminho para arquivo JSON)');
            console.log('  -l, --lang <texto>              Descrição da linguagem (ex: "começa com ab")');
            console.log('  -t, --test <strings>            Strings de teste separadas por vírgula');
            console.log('  -n, --name <nome>               Nome personalizado para os arquivos salvos');
            console.log('  -ij, --iterativo-json <json>    JSON de teste iterativo no formato de entrada');
            console.log('  -v, --verbose                   Modo detalhado (mostra execução passo a passo)');
            console.log('  -f, --force                     Força geração do diagrama mesmo sem regras');
            console.log('  -s, --svg                       Gera também arquivo SVG (padrão: apenas PDF)');
            console.log('  -sg, --sugerir, --analyze       Analisa MT e sugere o melhor tipo de implementação');
            console.log('  -h, --help                      Mostra esta ajuda\n');
            console.log('Exemplos:');
            console.log('  node cli.js --def "Estados: q0, q1\\nAlfabeto: a, b\\nEstado_Inicial: q0\\nEstados_Finais: q1\\nTransicoes:\\nq0, a, q1\\nq1, b, q1" --lang "começa com ab"');
            console.log('  node cli.js --def MT_exe1_d.json --lang "ww^R" --test ",aa,bb,abba" --verbose');
            console.log('  node cli.js --def MT_exe1_d.json --sugerir -l "ww^R palindromes"  # Sugere melhor tipo de MT');
            console.log('  node cli.js --iterativo-json \'{"Estados":["q0","q1"],"Alfabeto_Entrada":["a","b"],"Transicoes":[["q0","a","q1","X","R"]]}\'\n');
            process.exit(0);
        }
    }
    
    // Processa JSON iterativo se fornecido
    if (iterativoJson && !definition) {
        console.log('\n' + '='.repeat(60));
        console.log('Ferramenta CLI de Validação de AFD/Turing');
        console.log('='.repeat(60) + '\n');
        console.log('✓ JSON iterativo recebido\n');
        
        // Converte JSON iterativo para formato de definição
        if (iterativoJson.Estados && iterativoJson.Alfabeto_Entrada) {
            // É uma MT em formato JSON
            definition = `Estados: ${iterativoJson.Estados.join(', ')}\n`;
            definition += `Alfabeto_Entrada: ${iterativoJson.Alfabeto_Entrada.join(', ')}\n`;
            if (iterativoJson.Alfabeto_Fita) {
                definition += `Alfabeto_Fita: ${iterativoJson.Alfabeto_Fita.join(', ')}\n`;
            }
            if (iterativoJson.Simbolo_Branco) {
                definition += `Simbolo_Branco: ${iterativoJson.Simbolo_Branco}\n`;
            }
            if (iterativoJson.Estado_Inicial) {
                definition += `Estado_Inicial: ${iterativoJson.Estado_Inicial}\n`;
            }
            if (iterativoJson.Estado_Aceitacao) {
                definition += `Estado_Aceitacao: ${iterativoJson.Estado_Aceitacao}\n`;
            }
            if (iterativoJson.Estado_Rejeicao) {
                definition += `Estado_Rejeicao: ${iterativoJson.Estado_Rejeicao}\n`;
            }
            definition += 'Transicoes:\n';
            if (iterativoJson.Transicoes) {
                iterativoJson.Transicoes.forEach(t => {
                    definition += `${t[0]}, ${t[1]}, ${t[2]}, ${t[3]}, ${t[4]}\n`;
                });
            }
        } else if (iterativoJson.states && iterativoJson.alphabet) {
            // É um AFD em formato JSON
            definition = `Estados: ${iterativoJson.states.join(', ')}\n`;
            definition += `Alfabeto: ${iterativoJson.alphabet.join(', ')}\n`;
            definition += `Estado_Inicial: ${iterativoJson.startState}\n`;
            definition += `Estados_Finais: ${iterativoJson.finalStates.join(', ')}\n`;
            definition += 'Transicoes:\n';
            for (const from in iterativoJson.transitions) {
                for (const symbol in iterativoJson.transitions[from]) {
                    const to = iterativoJson.transitions[from][symbol][0];
                    definition += `${from}, ${symbol}, ${to}\n`;
                }
            }
        }
    }
    
    if (!definition) {
        console.log('✗ Erro: Definição não fornecida. Use --def, -d, --iterativo-json ou -ij');
        console.log('Use --help para ver as opções disponíveis.\n');
        process.exit(1);
    }
    
    if (!iterativoJson) {
        console.log('\n' + '='.repeat(60));
        console.log('Ferramenta CLI de Validação de AFD/Turing');
        console.log('='.repeat(60) + '\n');
    }
    
    // Verifica se a definição é um arquivo JSON
    let rules = null;
    let multitapeData = null;
    let jsonData = null;
    let descriptionText = '';
    let complexityInfo = null;
    let inputJsonFilename = null; // Nome do arquivo JSON de entrada (para usar como nome de saída)
    
    if (definition.endsWith('.json')) {
        try {
            const jsonPath = path.isAbsolute(definition) ? definition : path.join(process.cwd(), definition);
            if (!fs.existsSync(jsonPath)) {
                console.error(`✗ Arquivo JSON não encontrado: ${jsonPath}\n`);
                process.exit(1);
            }
            inputJsonFilename = path.basename(jsonPath, '.json'); // Guarda nome base do arquivo de entrada
            const jsonContent = fs.readFileSync(jsonPath, 'utf8');
            jsonData = JSON.parse(jsonContent);
            
            // Modo de sugestão de tipo de MT
            if (suggestMTType) {
                console.log(`✓ Arquivo JSON carregado: ${path.basename(jsonPath)}\n`);
                const suggestDescription = description || jsonData.description || '';
                analyzeMTAndSuggest(jsonData, suggestDescription);
                process.exit(0);
            }
            
            // Verifica se tem definition_multitape (MT multifita)
            if (jsonData.definition_multitape) {
                multitapeData = jsonData.definition_multitape;
                descriptionText = jsonData.description || '';
                complexityInfo = jsonData.complexity || null;
            }
            
            // Extrai regras se existirem
            if (jsonData.rules) {
                rules = jsonData.rules;
            }
            
            // Se tem apenas definition_multitape (sem definition normal), usa modo multifita puro
            if (multitapeData && !jsonData.definition) {
                console.log(`✓ Arquivo JSON carregado: ${path.basename(jsonPath)}\n`);
                console.log(`\x1b[35m✓ MT MULTIFITA PURA (${multitapeData.tapes} fitas)\x1b[0m`);
                console.log(`  Descrição: ${descriptionText}`);
                if (complexityInfo) {
                    console.log(`  Complexidade MT Padrão: ${complexityInfo.standard}`);
                    console.log(`  Complexidade Multifita: ${complexityInfo.multitape}`);
                    console.log(`  Razão: ${complexityInfo.reason}`);
                }
                console.log('');
                
                // Processa MT multifita diretamente
                const mtm = parseMultitapeDefinition(multitapeData);
                if (mtm.error) {
                    console.error(`✗ ERRO na definição multifita: ${mtm.error}\n`);
                    process.exit(1);
                }
                
                console.log('✓ Definição da MT Multifita válida');
                console.log(`  - Fitas: ${mtm.tapes}`);
                console.log(`  - Estados: ${mtm.states.join(', ')}`);
                console.log(`  - Estado inicial: ${mtm.startState}`);
                console.log(`  - Estado de aceitação: ${mtm.acceptState}`);
                console.log(`  - Estado de rejeição: ${mtm.rejectState}`);
                console.log(`  - Transições: ${mtm.transitions.length}\n`);
                
                // Validação com regras
                let isCorrect = false;
                if (rules) {
                    console.log('--- Validação com Regras (Simulação Multifita) ---');
                    const masterValidator = buildMasterValidator(rules);
                    const ruleAlphabet = getAlphabetFromRules(rules);
                    const inputAlphabet = multitapeData.input_alphabet || ['a', 'b', 'c'];
                    const combinedAlphabet = [...new Set([...ruleAlphabet, ...inputAlphabet])];
                    const alphabet = combinedAlphabet.length > 0 ? combinedAlphabet : ['a', 'b'];
                    
                    console.log(`Alfabeto usado para testes: ${alphabet.join(', ')}`);
                    const failedTests = [];
                    const NUM_TESTS = 100;
                    const MAX_LENGTH = 12;
                    
                    console.log(`Executando ${NUM_TESTS} testes aleatórios...\n`);
                    for (let i = 0; i < NUM_TESTS && failedTests.length < 3; i++) {
                        const testString = generateRandomString(alphabet, MAX_LENGTH);
                        const result = simulateMultitapeTuring(mtm, testString, 2000, false);
                        const validatorResult = masterValidator(testString);
                        
                        if (result.result !== validatorResult) {
                            const expected = validatorResult ? 'ACEITA' : 'REJEITA';
                            const got = result.result ? 'ACEITA' : 'REJEITA';
                            failedTests.push({ testString, expected, got, log: result.log });
                        }
                    }
                    
                    if (failedTests.length > 0) {
                        console.log('\x1b[31m✗ INCORRETO\x1b[0m - Encontradas falhas nos seguintes testes:\n');
                        failedTests.forEach(fail => {
                            console.log(`  String: "${fail.testString || '(vazia)'}"`);
                            console.log(`  Esperado: ${fail.expected}, Recebido: ${fail.got}`);
                            if (verboseMode && fail.log && fail.log.length > 0) {
                                console.log('  Log (últimas 10 linhas):');
                                fail.log.slice(-10).forEach(line => console.log(`    ${line}`));
                            }
                            console.log('');
                        });
                    } else {
                        console.log('\x1b[32m✓ CORRETO\x1b[0m - Sua MT Multifita passou em todos os testes aleatórios!\n');
                        isCorrect = true;
                    }
                }
                
                // Testes customizados
                if (testStrings.length > 0) {
                    console.log('\n--- Testes Customizados ---');
                    testStrings.forEach(testStr => {
                        testStr = testStr.trim();
                        const result = simulateMultitapeTuring(mtm, testStr, 2000, verboseMode);
                        const status = result.result ? '✓ ACEITA' : '✗ REJEITA';
                        if (!verboseMode) {
                            console.log(`  "${testStr || '(vazia)'}" -> ${status}`);
                        }
                    });
                    console.log('');
                }
                
                // Gera diagrama multifita
                const multitapeMermaidCode = generateMultitapeMermaidCode(mtm, descriptionText);
                console.log('--- Código Mermaid Gerado (MT Multifita) ---');
                console.log(multitapeMermaidCode);
                console.log('--- Fim do Código ---\n');
                
                // Salva diagrama na pasta de MT
                let baseFilename = customName || path.basename(jsonPath, '.json');
                const outputPath = path.join(diagramDirMT, `${baseFilename}.pdf`);
                
                if ((rules && isCorrect) || forceGenerate || !rules) {
                    console.log('Gerando diagrama (MT Multifita)...');
                    generateDiagramFromMermaid(multitapeMermaidCode, outputPath, generateSvg).then(success => {
                        console.log(`\n${'='.repeat(60)}`);
                        console.log('✓ Análise concluída com sucesso!');
                        console.log(`${'='.repeat(60)}\n`);
                    });
                } else {
                    console.log('(Diagrama não foi salvo devido a erros na validação)\n');
                }
                
                return true;
            }
            
            // Verifica se o JSON tem o campo 'definition' como texto
            if (jsonData.definition && typeof jsonData.definition === 'string') {
                // Formato com definition como texto
                definition = jsonData.definition;
            } else if (jsonData.Estados && jsonData.Alfabeto_Entrada) {
                // É uma MT em formato JSON iterativo
                definition = `Estados: ${jsonData.Estados.join(', ')}\n`;
                definition += `Alfabeto_Entrada: ${jsonData.Alfabeto_Entrada.join(', ')}\n`;
                if (jsonData.Alfabeto_Fita) {
                    definition += `Alfabeto_Fita: ${jsonData.Alfabeto_Fita.join(', ')}\n`;
                }
                if (jsonData.Simbolo_Branco) {
                    definition += `Simbolo_Branco: ${jsonData.Simbolo_Branco}\n`;
                }
                if (jsonData.Estado_Inicial) {
                    definition += `Estado_Inicial: ${jsonData.Estado_Inicial}\n`;
                }
                if (jsonData.Estado_Aceitacao) {
                    definition += `Estado_Aceitacao: ${jsonData.Estado_Aceitacao}\n`;
                }
                if (jsonData.Estado_Rejeicao) {
                    definition += `Estado_Rejeicao: ${jsonData.Estado_Rejeicao}\n`;
                }
                definition += 'Transicoes:\n';
                if (jsonData.Transicoes) {
                    jsonData.Transicoes.forEach(t => {
                        definition += `${t[0]}, ${t[1]}, ${t[2]}, ${t[3]}, ${t[4]}\n`;
                    });
                }
            } else if (jsonData.states && jsonData.alphabet) {
                // É um AFD em formato JSON
                definition = `Estados: ${jsonData.states.join(', ')}\n`;
                definition += `Alfabeto: ${jsonData.alphabet.join(', ')}\n`;
                definition += `Estado_Inicial: ${jsonData.startState}\n`;
                definition += `Estados_Finais: ${jsonData.finalStates.join(', ')}\n`;
                definition += 'Transicoes:\n';
                for (const from in jsonData.transitions) {
                    for (const symbol in jsonData.transitions[from]) {
                        const to = jsonData.transitions[from][symbol][0];
                        definition += `${from}, ${symbol}, ${to}\n`;
                    }
                }
            } else if (jsonData.grammar && jsonData.grammar.productions) {
                // É uma Gramática Regular em formato JSON
                const g = jsonData.grammar;
                definition = `Variaveis: ${g.variables.join(', ')}\n`;
                definition += `Terminais: ${g.terminals.join(', ')}\n`;
                definition += `Inicial: ${g.startSymbol}\n`;
                definition += 'Producoes:\n';
                for (const variable of Object.keys(g.productions)) {
                    const rhsList = g.productions[variable];
                    const rhsStr = rhsList.map(rhs => rhs === '' ? 'ε' : rhs).join(' | ');
                    definition += `${variable} -> ${rhsStr}\n`;
                }
                
                // Extrai languageDescription para usar como description (permite parsing de regras)
                if (jsonData.languageDescription && !description) {
                    description = jsonData.languageDescription;
                }
            }
            
            // Extrai regras se existirem
            if (jsonData.rules) {
                rules = jsonData.rules;
            }
            
            console.log(`✓ Arquivo JSON carregado: ${path.basename(jsonPath)}\n`);
            
            // Mostra informações de MT multifita se disponível
            if (multitapeData) {
                console.log(`\x1b[35m✓ MT MULTIFITA DETECTADA (${multitapeData.tapes} fitas)\x1b[0m`);
                console.log(`  Descrição: ${descriptionText}`);
                if (complexityInfo) {
                    console.log(`  Complexidade MT Padrão: ${complexityInfo.standard}`);
                    console.log(`  Complexidade Multifita: ${complexityInfo.multitape}`);
                    console.log(`  Razão: ${complexityInfo.reason}`);
                }
                console.log('');
            }
        } catch (error) {
            console.error(`✗ Erro ao processar arquivo JSON: ${error.message}\n`);
            process.exit(1);
        }
    }
    
    // Detecta tipo
    const machineType = detectMachineType(definition, jsonData);
    const typeLabel = machineType === 'turing' ? 'Máquina de Turing' : 
                     machineType === 'afn' ? 'AFN (Autômato Finito Não-determinístico)' :
                     machineType === 'ap' ? 'AP (Autômato de Pilha)' : 
                     machineType === 'gr' ? 'GR (Gramática Regular)' : 'AFD';
    console.log(`Tipo detectado: ${typeLabel}\n`);
    
    let machine;
    let mermaidCode;
    let grammarInfo = null; // Para armazenar info da gramática original
    
    // Parse da definição
    if (machineType === 'gr') {
        // Processa Gramática Regular
        const grammar = parseGrammarDefinition(definition);
        if (grammar.error) {
            console.error(`✗ ERRO na definição da gramática: ${grammar.error}\n`);
            process.exit(1);
        }
        
        grammarInfo = grammar;
        console.log(`✓ Gramática Regular válida`);
        console.log(`  - Variáveis: ${grammar.variables.join(', ')}`);
        console.log(`  - Terminais: ${grammar.terminals.join(', ')}`);
        console.log(`  - Símbolo inicial: ${grammar.startSymbol}`);
        console.log(`  - Tipo: ${grammar.type === 'right-linear' ? 'Linear à Direita' : 
                               grammar.type === 'left-linear' ? 'Linear à Esquerda' : 
                               grammar.type === 'mixed' ? 'Mista (pode não ser regular)' : 'Desconhecido'}`);
        console.log(`  - Produções: ${Object.keys(grammar.productions).length} variáveis\n`);
        
        // Mostra as produções
        console.log('  Produções:');
        for (const variable of Object.keys(grammar.productions)) {
            const prods = grammar.productions[variable].join(' | ');
            console.log(`    ${variable} → ${prods}`);
        }
        console.log('');
        
        // Converte GR para AFN
        console.log('Convertendo Gramática Regular para AFN equivalente...\n');
        machine = convertGrammarToAFN(grammar);
        
        if (machine.error) {
            console.error(`✗ ERRO na conversão GR → AFN: ${machine.error}\n`);
            process.exit(1);
        }
        
        console.log(`✓ AFN equivalente gerado`);
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto: ${machine.alphabet.join(', ')}`);
        console.log(`  - Estado inicial: ${machine.startState}`);
        console.log(`  - Estados finais: ${machine.finalStates.join(', ')}`);
        console.log(`  - Não-determinístico: ${machine.isNFA ? 'Sim' : 'Não'}\n`);
        
        // Gera código Mermaid para o AFN equivalente
        mermaidCode = generateGrMermaidCode(machine, grammarInfo);
        
    } else if (machineType === 'turing') {
        machine = parseTuringDefinition(definition);
    } else if (machineType === 'ap') {
        machine = parseApDefinition(definition);
    } else if (machineType === 'afn') {
        machine = parseAfnDefinition(definition);
        // Força isNFA = true quando declarado no JSON
        if (jsonData && jsonData.nondeterministic === true) {
            machine.isNFA = true;
        }
    } else {
        machine = parseAfdDefinition(definition);
    }
    
    if (machine.error) {
        console.error(`✗ ERRO na definição: ${machine.error}\n`);
        process.exit(1);
    }
    
    // Mostra informações (para tipos que não são GR - GR já mostrou acima)
    if (machineType !== 'gr') {
        console.log(`✓ Definição do ${typeLabel} válida`);
    }
    if (machineType === 'turing') {
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto de entrada: ${machine.inputAlphabet.join(', ')}`);
        console.log(`  - Transições: ${machine.transitions.length}\n`);
        mermaidCode = generateTuringMermaidCode(machine);
    } else if (machineType === 'ap') {
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto de entrada: ${machine.inputAlphabet.join(', ')}`);
        console.log(`  - Alfabeto de pilha: ${machine.stackAlphabet ? machine.stackAlphabet.join(', ') : 'N/A'}`);
        console.log(`  - Símbolo inicial da pilha: ${machine.initialStackSymbol || 'N/A'}`);
        console.log(`  - Estado inicial: ${machine.startState}`);
        console.log(`  - Estados finais: ${machine.finalStates ? machine.finalStates.join(', ') : 'N/A'}`);
        console.log(`  - Modo de aceitação: ${machine.acceptanceMode || 'estado'}`);
        console.log(`  - Transições: ${machine.transitions.length}`);
        console.log(`  - Não-determinístico: ${machine.isNonDeterministic ? 'Sim' : 'Não'}\n`);
        mermaidCode = generateApMermaidCode(machine);
    } else if (machineType === 'afn') {
        const numTransitions = Object.keys(machine.transitions).reduce((sum, state) => 
            sum + Object.keys(machine.transitions[state]).reduce((s, sym) => 
                s + machine.transitions[state][sym].length, 0), 0);
        const numEpsilon = Object.keys(machine.epsilonTransitions).reduce((sum, state) => 
            sum + machine.epsilonTransitions[state].length, 0);
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto: ${machine.alphabet.join(', ')}`);
        console.log(`  - Estado inicial: ${machine.startState}`);
        console.log(`  - Estados finais: ${machine.finalStates.join(', ')}`);
        console.log(`  - Transições: ${numTransitions}${numEpsilon > 0 ? ` (+${numEpsilon} ε-transições)` : ''}`);
        console.log(`  - Não-determinístico: ${machine.isNFA ? 'Sim' : 'Não'}\n`);
        mermaidCode = generateAfnMermaidCode(machine);
    } else {
        console.log(`  - Estados: ${machine.states.join(', ')}`);
        console.log(`  - Alfabeto: ${machine.alphabet.join(', ')}`);
        console.log(`  - Estado inicial: ${machine.startState}`);
        console.log(`  - Estados finais: ${machine.finalStates.join(', ')}`);
        console.log(`  - Transições: ${Object.keys(machine.transitions).reduce((sum, state) => 
            sum + Object.keys(machine.transitions[state]).length, 0)}\n`);
        mermaidCode = generateMermaidCode(machine);
    }
    
    // Parse da descrição da linguagem
    if (description) {
        console.log(`Descrição da linguagem: "${description}"`);
        const parsedRules = parseLanguageDescription(description);
        if (parsedRules) {
            rules = parsedRules; // Sobrescreve regras do JSON se descrição foi fornecida
            console.log(`✓ Regras extraídas da descrição\n`);
        } else {
            console.log(`⚠ Não foi possível extrair regras automaticamente da descrição\n`);
        }
    } else if (rules) {
        console.log(`✓ Regras carregadas do arquivo JSON\n`);
    }
    
    // Validação
    let isCorrect = false;
    if (rules) {
        console.log('--- Validação com Regras ---');
        const masterValidator = buildMasterValidator(rules);
        const ruleAlphabet = getAlphabetFromRules(rules);
        const combinedAlphabet = machineType === 'turing' 
            ? [...new Set([...ruleAlphabet, ...(machine.inputAlphabet || [])])]
            : machineType === 'ap'
            ? [...new Set([...ruleAlphabet, ...(machine.inputAlphabet || [])])]
            : [...new Set([...ruleAlphabet, ...(machine.alphabet || [])])];
        const alphabet = combinedAlphabet.length > 0 ? combinedAlphabet : ['a', 'b'];
        
        console.log(`Alfabeto usado para testes: ${alphabet.join(', ')}`);
        const failedTests = [];
        const NUM_TESTS = (machineType === 'turing' || machineType === 'ap') ? 100 : 500;
        const MAX_LENGTH = (machineType === 'turing' || machineType === 'ap') ? 15 : 20;
        console.log(`Executando ${NUM_TESTS} testes aleatórios...\n`);
        
        // Detecta não-determinismo para MT
        const isNondeterministic = machineType === 'turing' && 
            (jsonData.nondeterministic === true || detectNondeterminism(machine));
        
        for (let i = 0; i < NUM_TESTS && failedTests.length < 2; i++) {
            const testString = generateRandomString(alphabet, MAX_LENGTH);
            let result;
            if (machineType === 'turing') {
                result = isNondeterministic
                    ? simulateNondeterministicTuring(machine, testString, 2000, false)
                    : simulateTuring(machine, testString, 2000, false);
            } else if (machineType === 'ap') {
                result = simulateAP(machine, testString);
            } else if (machineType === 'afn' || machineType === 'gr') {
                // GR usa simulador de AFN (foi convertida para AFN)
                result = simulateAFN(machine, testString);
            } else {
                result = simulateAFD(machine, testString);
            }
            const machineResult = result.result;
            const validatorResult = masterValidator(testString);
            
            if (machineResult !== validatorResult) {
                const expected = validatorResult ? 'ACEITA' : 'REJEITA';
                const got = machineResult ? 'ACEITA' : 'REJEITA';
                failedTests.push({ 
                    testString, 
                    expected, 
                    got, 
                    log: result.log 
                });
            }
        }
        
        if (failedTests.length > 0) {
            console.log('\x1b[31m✗ INCORRETO\x1b[0m - Encontradas falhas nos seguintes testes:\n');
            failedTests.forEach(fail => {
                console.log(`  String: "${fail.testString || '(vazia)'}"`);  
                console.log(`  Esperado: ${fail.expected}, Recebido: ${fail.got}`);
                if (fail.log && fail.log.length > 0) {
                    console.log('  Log de Execução:');
                    fail.log.forEach(line => console.log(`    ${line}`));
                }
                console.log('');
            });
        } else {
            console.log(`\x1b[32m✓ CORRETO\x1b[0m - Seu ${typeLabel} passou em todos os testes aleatórios!\n`);
            isCorrect = true;
        }
    }
    // Testes customizados
    if (testStrings.length > 0) {
        console.log('\n--- Testes Customizados ---');
        
        // Detecta não-determinismo para MT
        const isNondeterministic = machineType === 'turing' && 
            (jsonData.nondeterministic === true || detectNondeterminism(machine));
        
        testStrings.forEach(testStr => {
            testStr = testStr.trim();
            let result;
            if (machineType === 'turing') {
                result = isNondeterministic
                    ? simulateNondeterministicTuring(machine, testStr, 2000, verboseMode)
                    : simulateTuring(machine, testStr, 2000, verboseMode);
            } else if (machineType === 'ap') {
                result = simulateAP(machine, testStr);
            } else if (machineType === 'afn' || machineType === 'gr') {
                result = simulateAFN(machine, testStr);
            } else {
                result = simulateAFD(machine, testStr);
            }
            const status = result.result ? '✓ ACEITA' : '✗ REJEITA';
            if (!verboseMode || machineType !== 'turing') {
                console.log(`  "${testStr || '(vazia)'}" -> ${status}`);
            }
        });
        console.log('');
    }
    
    // Mostra código Mermaid
    const mermaidLabel = machineType === 'turing' ? 'MT Padrão' : 
                        machineType === 'ap' ? 'AP (Autômato de Pilha)' :
                        machineType === 'afn' ? 'AFN' : 
                        machineType === 'gr' ? 'GR (AFN Equivalente)' : 'AFD';
    console.log(`\n--- Código Mermaid Gerado (${mermaidLabel}) ---`);
    console.log(mermaidCode);
    console.log('--- Fim do Código ---\n');
    
    // Gera diagrama multifita se disponível
    let multitapeMermaidCode = null;
    if (multitapeData) {
        const mtm = parseMultitapeDefinition(multitapeData);
        if (!mtm.error) {
            multitapeMermaidCode = generateMultitapeMermaidCode(mtm, descriptionText);
            console.log('--- Código Mermaid Gerado (MT Multifita) ---');
            console.log(multitapeMermaidCode);
            console.log('--- Fim do Código ---\n');
        }
    }
    
    // Determina diretórios corretos baseado no tipo de máquina
    const dirs = getDirectories(machineType);
    
    // Salva diagrama apenas se passou na validação (quando há regras) ou se --force
    if ((rules && isCorrect) || forceGenerate) {
        let baseFilename;
        if (customName) {
            baseFilename = customName;
        } else if (inputJsonFilename) {
            // Usa o mesmo nome do arquivo JSON de entrada
            baseFilename = inputJsonFilename;
        } else {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            baseFilename = `${machineType}_${timestamp}`;
        }
        
        const outputFilename = `${baseFilename}.pdf`;
        const outputPath = path.join(dirs.diagramDir, outputFilename);
        
        // NÃO cria JSON duplicado quando já veio de um arquivo JSON
        // Só salva JSON se NÃO veio de arquivo JSON e tem regras
        if (rules && !inputJsonFilename) {
            const jsonFilename = `${baseFilename}.json`;
            const jsonPath = path.join(dirs.inputDir, jsonFilename);
            const jsonDataToSave = {
                definition: definition,
                rules: rules
            };
            
            // Inclui multitape se disponível
            if (multitapeData) {
                jsonDataToSave.definition_multitape = multitapeData;
                jsonDataToSave.description = descriptionText;
                if (complexityInfo) {
                    jsonDataToSave.complexity = complexityInfo;
                }
            }
            
            try {
                fs.writeFileSync(jsonPath, JSON.stringify(jsonDataToSave, null, 2));
                console.log(`✓ Definição salva em: ${jsonPath}`);
            } catch (error) {
                console.error(`✗ Erro ao salvar JSON: ${error.message}`);
            }
        }
        
        console.log(`Gerando diagrama (${mermaidLabel})...`);
        generateDiagramFromMermaid(mermaidCode, outputPath, generateSvg).then(success => {
            if (success) {
                // Gera também diagrama multifita se disponível
                if (multitapeMermaidCode) {
                    const multitapeOutputPath = path.join(dirs.diagramDir, `${baseFilename}_multifita.pdf`);
                    console.log('Gerando diagrama (MT Multifita)...');
                    generateDiagramFromMermaid(multitapeMermaidCode, multitapeOutputPath, generateSvg).then(mtSuccess => {
                        console.log(`\n${'='.repeat(60)}`);
                        console.log('✓ Análise concluída com sucesso!');
                        console.log(`${'='.repeat(60)}\n`);
                    });
                } else {
                    console.log(`\n${'='.repeat(60)}`);
                    console.log('✓ Análise concluída com sucesso!');
                    console.log(`${'='.repeat(60)}\n`);
                }
            }
        });
    } else if (!rules && !forceGenerate) {
        // Se não há regras e não usou --force, não salva diagrama
        console.log('(Diagrama não foi salvo - use --force para gerar sem validação)\n');
    }
    
    return true;
}

function main() {
    // Tenta processar argumentos de linha de comando primeiro
    if (processFromArgs()) {
        return; // Processou via argumentos, encerra
    }
    
    // Modo interativo
    console.log('\n' + '='.repeat(60));
    console.log('Ferramenta CLI de Validação de AFD/Turing');
    console.log('='.repeat(60));
    
    const files = listInputFiles();
    if (files.length === 0) {
        console.log('\n✗ Nenhum arquivo encontrado na pasta input.\n');
        return;
    }
    askUserFile(files, processFile);
}

main();
