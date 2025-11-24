// --- Inicialização ---
mermaid.initialize({ startOnLoad: false });

// --- Variáveis Globais ---
let lastGeneratedMermaidCode = '';
let currentMachineType = 'afd';

// --- DOM Elements ---
const editor = document.getElementById('mermaid-editor');
const diagramOutput = document.getElementById('diagram-output');
const checkButton = document.getElementById('check-button');
const feedbackContainer = document.getElementById('feedback-container');
const formulaContainer = document.getElementById('formula-container');
const addGroupBtn = document.getElementById('add-group-btn');
const copyMermaidBtn = document.getElementById('copy-mermaid-btn');
const downloadSvgBtn = document.getElementById('download-svg-btn');
const editorTitle = document.getElementById('editor-title');

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
        func: (str, { pattern, condition }) => {
            if (!pattern || !condition) return true;
            try {
                // 1. Constrói a Regex para capturar as partes
                // Ex: a*b*a* -> ^(a*)(b*)(a*)$
                const regexPattern = pattern.split('').map(char => `(${char}*)`).join('');
                const regex = new RegExp(`^${regexPattern}$`);
                const match = str.match(regex);

                if (!match) return false; // A palavra não corresponde ao formato

                // 2. Extrai as contagens (i, j, k, etc.)
                const counts = match.slice(1).map(part => part ? part.length : 0);
                const [i, j, k] = counts; // Para o nosso problema específico

                // 3. Avalia a condição matemática
                // CUIDADO: eval é poderoso, mas use com cautela. Para esta ferramenta local, é aceitável.
                return eval(condition);
            } catch (e) { console.error("Erro na regra Estruturada:", e); return false; }
        },
        text: 'Linguagem Estruturada'
    }
};

// --- Lógica da Interface Dinâmica ---

function createRuleElement(type, groupBody) {
    const ruleId = `rule-${Date.now()}`;
    const pill = document.createElement('div');
    pill.className = 'rule-pill';
    pill.id = ruleId;
    pill.dataset.type = type;

    const negationContainer = document.createElement('div');
    negationContainer.className = 'negation-control';
    negationContainer.innerHTML = `<input type="checkbox" class="rule-negation-check" id="negate-${ruleId}"><label for="negate-${ruleId}">NÃO</label>`;

    const ruleContent = document.createElement('div');
    ruleContent.className = 'rule-content';

    if (type === 'count') {
        ruleContent.innerHTML = `<span>A contagem de</span>
            <select class="rule-count-subject">
                <option value="total">comprimento total</option>
                <option value="char">caractere:</option>
            </select>
            <input type="text" class="rule-count-char" maxlength="1" placeholder="x" style="display:none;">
            <select class="rule-count-operator">
                <option value="==">==</option>
                <option value=">=">&gt;=</option>
                <option value="<="><=</option>
                <option value="even">é par</option>
                <option value="odd">é ímpar</option>
                <option value="%">módulo</option>
            </select>
            <input type="number" class="rule-count-n" placeholder="N">
            <span class="modulo-extra" style="display:none;"> == </span>
            <input type="number" class="rule-count-m" style="display:none;" placeholder="M">`;
    } else if (type === 'substringCount') {
        ruleContent.innerHTML = `<span>A contagem da subpalavra</span>
            <input type="text" class="rule-value" placeholder="sub">
            <span>é</span>
            <select class="rule-value-type">
                <option value="even">par</option>
                <option value="odd">ímpar</option>
            </select>`;
    } else if (type === 'structuredLanguage') {
        ruleContent.innerHTML = `<span>L = {</span>
            <input type="text" class="rule-pattern" placeholder="ex: aba" style="width: 80px;">
            <span> | </span>
            <input type="text" class="rule-condition" placeholder="ex: j == Math.max(i, k)" style="width: 200px;">
            <span>}</span>`;
    } else {
        const placeholder = type === 'regex' ? 'ex: a(b|c)*' : 'valor...';
        ruleContent.innerHTML = `<span>${validators[type].text}</span>
                   <input type="text" class="rule-value" placeholder="${placeholder}">`;
    }

    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-rule-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => pill.remove();

    pill.appendChild(negationContainer);
    pill.appendChild(ruleContent);
    pill.appendChild(removeBtn);
    groupBody.appendChild(pill);

    if (type === 'count') {
        const subjectSelect = pill.querySelector('.rule-count-subject');
        const charInput = pill.querySelector('.rule-count-char');
        const opSelect = pill.querySelector('.rule-count-operator');
        const nInput = pill.querySelector('.rule-count-n');
        const mExtra = pill.querySelector('.modulo-extra');
        const mInput = pill.querySelector('.rule-count-m');
        subjectSelect.onchange = () => charInput.style.display = subjectSelect.value === 'char' ? 'inline-block' : 'none';
        opSelect.onchange = () => {
            const isModulo = opSelect.value === '%';
            const isParity = ['even', 'odd'].includes(opSelect.value);
            mExtra.style.display = isModulo ? 'inline-block' : 'none';
            mInput.style.display = isModulo ? 'inline-block' : 'none';
            nInput.style.display = isParity ? 'none' : 'inline-block';
        };
        opSelect.onchange(); // Trigger on creation
    }
}

function createRuleSelectionMenu(groupBody, addRuleBtn) {
    const menu = document.createElement('select');
    menu.innerHTML = `<option value="">Selecione uma regra...</option>`
        + Object.keys(validators).map(key => `<option value="${key}">${validators[key].text}</option>`).join('');
    menu.onchange = (e) => {
        if (e.target.value) createRuleElement(e.target.value, groupBody);
        menu.remove();
        addRuleBtn.style.display = 'inline-block';
    };
    groupBody.appendChild(menu);
    addRuleBtn.style.display = 'none';
}

function cleanupOrSeparators() {
    const firstChild = formulaContainer.firstElementChild;
    if (firstChild && firstChild.classList.contains('or-separator')) firstChild.remove();
}

function addGroup() {
    const groupId = `group-${Date.now()}`;
    const groupDiv = document.createElement('div');
    groupDiv.className = 'and-group';
    groupDiv.id = groupId;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    const removeGroupBtn = document.createElement('button');
    removeGroupBtn.className = 'remove-group-btn';
    removeGroupBtn.innerHTML = '&times; Remover Grupo';
    removeGroupBtn.onclick = () => {
        const orSeparator = groupDiv.previousElementSibling;
        if (orSeparator && orSeparator.classList.contains('or-separator')) orSeparator.remove();
        groupDiv.remove();
        cleanupOrSeparators();
    };
    groupHeader.appendChild(removeGroupBtn);
    const groupBody = document.createElement('div');
    groupBody.className = 'group-body';
    const addRuleBtn = document.createElement('button');
    addRuleBtn.className = 'add-rule-btn';
    addRuleBtn.textContent = '+ Adicionar Regra (E)';
    addRuleBtn.onclick = () => createRuleSelectionMenu(groupBody, addRuleBtn);
    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(groupBody);
    groupDiv.appendChild(addRuleBtn);
    if (formulaContainer.children.length > 0) {
        const orSeparator = document.createElement('div');
        orSeparator.className = 'or-separator';
        orSeparator.textContent = 'OU';
        formulaContainer.appendChild(orSeparator);
    }
    formulaContainer.appendChild(groupDiv);
}

// --- Lógica de Validação ---

function buildMasterValidator() {
    const groupValidators = [];
    document.querySelectorAll('.and-group').forEach(group => {
        const rulesInGroup = [];
        group.querySelectorAll('.rule-pill').forEach(pill => {
            const type = pill.dataset.type;
            const isNegated = pill.querySelector('.rule-negation-check').checked;
            if (type === 'count') {
                const subjectType = pill.querySelector('.rule-count-subject').value;
                const char = pill.querySelector('.rule-count-char').value;
                const operator = pill.querySelector('.rule-count-operator').value;
                const n = parseInt(pill.querySelector('.rule-count-n').value, 10);
                const m = parseInt(pill.querySelector('.rule-count-m').value, 10);
                if (subjectType === 'char' && !char) return;
                rulesInGroup.push({ validatorKey: type, value: { subject: { type: subjectType, char }, operator, N: n, M: m }, isNegated });
            } else if (type === 'substringCount') {
                const sub = pill.querySelector('.rule-value').value;
                const parityType = pill.querySelector('.rule-value-type').value;
                if (sub) {
                    rulesInGroup.push({ validatorKey: type, value: { sub, type: parityType }, isNegated });
                }
            } else if (type === 'structuredLanguage') {
                const pattern = pill.querySelector('.rule-pattern').value;
                const condition = pill.querySelector('.rule-condition').value;
                if (pattern && condition)
                    rulesInGroup.push({ validatorKey: type, value: { pattern, condition }, isNegated });
            } else {
                const input = pill.querySelector('.rule-value');
                if (input && input.value) {
                    rulesInGroup.push({ validatorKey: type, value: input.value, isNegated });
                }
            }
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

// --- Funções Legadas ---

function getAlphabetFromRules() {
    const chars = new Set();
    document.querySelectorAll('.rule-pill').forEach(pill => {
        const type = pill.dataset.type;
        const charInput = pill.querySelector('.rule-count-char');
        const valueInput = pill.querySelector('.rule-value');

        if (type === 'count' && charInput && charInput.value) {
            chars.add(charInput.value);
        } else if (type === 'regex' && valueInput && valueInput.value) {
            const plainChars = valueInput.value.replace(/[.*+?^${}()|[\\\]]/g, '');
            plainChars.split('').forEach(char => chars.add(char));
        } else if (valueInput && valueInput.value) {
            valueInput.value.split('').forEach(char => chars.add(char));
        }
    });
    return [...chars];
}

function generateRandomString(alphabet, maxLength) {
    const length = Math.floor(Math.random() * (maxLength + 1));
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
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
            // Remove comentários da linha antes de processar
            line = line.split('//')[0].trim();
            if (!line) continue; // Pula a linha se ela ficar vazia após remover o comentário

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
    lastGeneratedMermaidCode = mermaidStr; // Salva o código gerado
    return mermaidStr;
}

function generateTuringMermaidCode(tm) {
    if (!tm || tm.error) return '';
    let mermaidStr = 'stateDiagram-v2\n';
    mermaidStr += '    classDef accept fill:#90EE90,stroke:#006400,stroke-width:4px\n';
    mermaidStr += '    classDef reject fill:#FFB6C1,stroke:#8B0000,stroke-width:4px\n';
    mermaidStr += `    [*] --> ${tm.startState}\n`;
    
    // Agrupa transições entre os mesmos estados
    const transitionMap = {};
    tm.transitions.forEach(t => {
        const key = `${t.from}->${t.to}`;
        if (!transitionMap[key]) {
            transitionMap[key] = [];
        }
        transitionMap[key].push(`${t.read}/${t.write},${t.direction}`);
    });
    
    // Gera as transições agrupadas
    for (const key in transitionMap) {
        const [from, to] = key.split('->');
        const labels = transitionMap[key];
        // Limita a 3 transições por linha para melhor legibilidade
        const formattedLabels = [];
        for (let i = 0; i < labels.length; i += 3) {
            formattedLabels.push(labels.slice(i, i + 3).join(' | '));
        }
        const label = formattedLabels.join('<br/>');
        mermaidStr += `    ${from} --> ${to}: ${label}\n`;
    }
    
    // Marca estados especiais
    mermaidStr += `    class ${tm.acceptState} accept\n`;
    mermaidStr += `    class ${tm.rejectState} reject\n`;
    
    lastGeneratedMermaidCode = mermaidStr;
    return mermaidStr;
}

function simulateAFD(afd, inputString) {
    let currentState = afd.startState;
    for (const char of inputString) {
        if (afd.transitions[currentState] && afd.transitions[currentState][char]) {
            currentState = afd.transitions[currentState][char][0];
        } else { return false; }
    }
    return afd.finalStates.includes(currentState);
}

function simulateTuring(tm, inputString, maxSteps = 2000) {
    let tape = inputString.split('');
    if (tape.length === 0) tape = [tm.blank];
    let head = 0;
    let currentState = tm.startState;
    let steps = 0;
    const log = [];

    const formatTape = () => {
        return tape.map((char, index) => index === head ? `<strong>[${char}]</strong>` : char).join('');
    };

    while (currentState !== tm.acceptState && currentState !== tm.rejectState && steps < maxSteps) {
        if (head < 0) {
            log.push(`ERRO: Cabeçote moveu para posição negativa (${head}).`);
            return { result: false, log };
        }
        while (head >= tape.length) tape.push(tm.blank);
        
        const currentSymbol = tape[head] || tm.blank;
        const transition = tm.transitions.find(t => 
            t.from === currentState && (t.read === currentSymbol || t.read === '*')
        );

        log.push(`Passo ${steps}: Estado=${currentState}, Fita=${formatTape()}, Lendo='${currentSymbol}'`);

        if (!transition) {
            log.push(`FIM: Nenhuma transição encontrada para o estado '${currentState}' com o símbolo '${currentSymbol}'. A máquina para e rejeita.`);
            return { result: false, log };
        }

        log.push(` -> Transição encontrada: (${transition.from}, ${transition.read}) -> (${transition.to}, ${transition.write}, ${transition.direction}).`);

        tape[head] = transition.write;
        currentState = transition.to;
        
        if (transition.direction === 'R') head++;
        else if (transition.direction === 'L') head--;

        steps++;
    }

    if (steps >= maxSteps) log.push(`FIM: Número máximo de passos (${maxSteps}) atingido. A máquina para e rejeita.`);
    else log.push(`FIM: Estado final '${currentState}' atingido.`);

    return { result: currentState === tm.acceptState, log };
}

async function renderDiagram(code) {
    try {
        diagramOutput.innerHTML = '';
        if (code.trim() === '') return;
        const { svg } = await mermaid.render('graphDiv', code);
        diagramOutput.innerHTML = svg;
    } catch (e) { diagramOutput.innerHTML = `<pre style="color: red;">${e.message}</pre>`; }
}

function updateApp() {
    const definitionText = editor.value;
    if (currentMachineType === 'turing') {
        const tm = parseTuringDefinition(definitionText);
        if (tm.error) {
            diagramOutput.innerHTML = `<pre style="color: orange;">${tm.error}</pre>`;
            return null;
        }
        const mermaidCode = generateTuringMermaidCode(tm);
        renderDiagram(mermaidCode);
        return tm;
    } else {
        const afd = parseAfdDefinition(definitionText);
        if (afd.error) {
            diagramOutput.innerHTML = `<pre style="color: orange;">${afd.error}</pre>`;
            return null;
        }
        const mermaidCode = generateMermaidCode(afd);
        renderDiagram(mermaidCode);
        return afd;
    }
}

function checkSolution() {
    feedbackContainer.innerHTML = '';
    
    if (currentMachineType === 'turing') {
        const tm = parseTuringDefinition(editor.value);
        if (!tm || tm.error) {
            feedbackContainer.innerHTML = `<span style="color: red;">Erro na definição da Máquina de Turing: ${tm.error}</span>`;
            return;
        }
        const masterValidator = buildMasterValidator();
        
        const ruleAlphabet = getAlphabetFromRules();
        const combinedAlphabet = [...new Set([...ruleAlphabet, ...(tm.inputAlphabet || [])])];
        const alphabet = combinedAlphabet.length > 0 ? combinedAlphabet : ['a', 'b'];

        const failedTests = [];
        const NUM_TESTS = 100;
        const MAX_LENGTH = 15;
        for (let i = 0; i < NUM_TESTS && failedTests.length < 5; i++) {
            const testString = generateRandomString(alphabet, MAX_LENGTH);
            const simulationResult = simulateTuring(tm, testString);
            const validatorResult = masterValidator(testString);
            if (simulationResult.result !== validatorResult) {
                const expected = validatorResult ? 'ACEITA' : 'REJEITADA';
                const got = simulationResult.result ? 'ACEITA' : 'REJEITADA';
                failedTests.push({ testString, expected, got, log: simulationResult.log });
            }
        }

        if (failedTests.length > 0) {
            let errorHtml = '<span style="color: red;">Incorreto. Encontradas falhas nos seguintes testes:</span><ul style="color: red; text-align: left; font-size: 16px;">';
            failedTests.forEach(fail => {
                const logId = `log-${Date.now()}-${Math.random()}`;
                errorHtml += `<li>
                    String: "<strong>${fail.testString || '(vazia)'}</strong>" | Esperado: ${fail.expected}, Recebido: ${fail.got}
                    <details style="margin-top: 8px; font-size: 12px; color: #333; background-color: #f0f0f0; border: 1px solid #ccc; padding: 5px; border-radius: 4px;">
                        <summary style="cursor: pointer; font-weight: bold;">Ver Log de Execução</summary>
                        <pre style="white-space: pre-wrap; margin-top: 5px;">${fail.log.join('\n')}</pre>
                    </details>
                </li>`;
            });
            errorHtml += '</ul>';
            feedbackContainer.innerHTML = errorHtml;
        } else {
            feedbackContainer.innerHTML = '<span style="color: green;">Correto! Sua Máquina de Turing passou em todos os testes aleatórios.</span>';
        }
    } else {
        const afd = parseAfdDefinition(editor.value);
        if (!afd || afd.error) {
            feedbackContainer.innerHTML = `<span style="color: red;">Erro na definição do AFD: ${afd.error}</span>`;
            return;
        }
        const masterValidator = buildMasterValidator();
        
        const ruleAlphabet = getAlphabetFromRules();
        const combinedAlphabet = [...new Set([...ruleAlphabet, ...(afd.alphabet || [])])];
        const alphabet = combinedAlphabet.length > 0 ? combinedAlphabet : ['a', 'b'];

        const failedTests = [];
        const NUM_TESTS = 500;
        const MAX_LENGTH = 20;
        for (let i = 0; i < NUM_TESTS && failedTests.length < 5; i++) {
            const testString = generateRandomString(alphabet, MAX_LENGTH);
            const afdResult = simulateAFD(afd, testString);
            const validatorResult = masterValidator(testString);
            if (afdResult !== validatorResult) {
                const expected = validatorResult ? 'ACEITA' : 'REJEITADA';
                const got = afdResult ? 'ACEITA' : 'REJEITADA';
                failedTests.push({ testString, expected, got });
            }
        }

        if (failedTests.length > 0) {
            let errorHtml = '<span style="color: red;">Incorreto. Encontradas falhas nos seguintes testes:</span><ul style="color: red; text-align: left; font-size: 16px;">';
            failedTests.forEach(fail => {
                errorHtml += `<li>String: "<strong>${fail.testString || '(vazia)'}</strong>" | Esperado: ${fail.expected}, Recebido: ${fail.got}</li>`;
            });
            errorHtml += '</ul>';
            feedbackContainer.innerHTML = errorHtml;
        } else {
            feedbackContainer.innerHTML = '<span style="color: green;">Correto! Seu AFD passou em todos os testes aleatórios.</span>';
        }
    }
}

function copyMermaidToClipboard() {
    if (!lastGeneratedMermaidCode) return;
    navigator.clipboard.writeText(lastGeneratedMermaidCode).then(() => {
        const originalText = copyMermaidBtn.textContent;
        copyMermaidBtn.textContent = 'Copiado!';
        setTimeout(() => {
            copyMermaidBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar código: ', err);
    });
}

function downloadSVG() {
    const svgElement = diagramOutput.querySelector('svg');
    if (!svgElement) {
        alert("Nenhum diagrama SVG para baixar. Gere um diagrama primeiro.");
        return;
    }

    // Serializa o SVG para uma string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);

    // Cria um Blob e uma URL para o download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Cria um link temporário e simula o clique para baixar
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagrama.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Inicialização da Página ---
window.onload = () => {
    addGroupBtn.addEventListener('click', addGroup);
    editor.addEventListener('input', updateApp);
    checkButton.addEventListener('click', checkSolution);
    copyMermaidBtn.addEventListener('click', copyMermaidToClipboard);
    downloadSvgBtn.addEventListener('click', downloadSVG);
    
    // Seletor de tipo de máquina
    document.querySelectorAll('input[name="machine-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentMachineType = e.target.value;
            if (currentMachineType === 'turing') {
                editorTitle.textContent = 'Definição da Máquina de Turing:';
                editor.placeholder = `Estados: q0, q1, q2, qaccept, qreject
Alfabeto_Entrada: a, b
Alfabeto_Fita: a, b, _, X
Simbolo_Branco: _
Estado_Inicial: q0
Estado_Aceitacao: qaccept
Estado_Rejeicao: qreject
Transicoes:
q0, a, q1, X, R
q1, a, q1, a, R
q1, b, q2, b, L`;
            } else {
                editorTitle.textContent = 'Definição do AFD:';
                editor.placeholder = 'Digite seu código Mermaid aqui...';
            }
            editor.value = '';
            feedbackContainer.innerHTML = '';
            updateApp();
        });
    });
    
    addGroup();
};