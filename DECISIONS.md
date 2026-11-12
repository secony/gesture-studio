# Registro de decisões técnicas — Gesture Studio

Este documento registra decisões arquiteturais e técnicas relevantes para preservar o contexto do desenvolvimento.

As decisões podem ser revisadas quando novas evidências justificarem mudanças. Decisões substituídas permanecem no histórico para explicar a evolução do projeto.

## DEC-001 — React e TypeScript como base

**Status:** Adotada.

**Decisão:**

Utilizar React e TypeScript como base da aplicação.

**Justificativa:**

A combinação oferece uma estrutura adequada para interfaces interativas, componentes reutilizáveis, tipagem estática e integração com bibliotecas de visão computacional.

---

## DEC-002 — MediaPipe Tasks Vision para rastreamento

**Status:** Adotada.

**Decisão:**

Utilizar MediaPipe Tasks Vision para detectar e rastrear as mãos.

**Justificativa:**

A biblioteca oferece rastreamento de landmarks em tempo real no navegador, permitindo manter o processamento integrado à aplicação web.

---

## DEC-003 — Separação entre classificação e estabilização

**Status:** Adotada.

**Decisão:**

Manter GestureClassifier e GestureEngine como responsabilidades separadas.

**Justificativa:**

A classificação identifica o gesto em um frame. A estabilização considera o histórico temporal para reduzir oscilações e transições acidentais.

---

## DEC-004 — Estabilização temporal dos gestos

**Status:** Adotada e validada funcionalmente.

**Decisão:**

Utilizar histórico de frames consecutivos para estabilizar os gestos.

A implementação atual utiliza:

- 3 frames para estabilização geral.
- 6 frames para liberação da pinça.
- Tolerância de até 5 frames sem detecção.

**Justificativa:**

Reduzir oscilações na classificação e evitar encerramentos prematuros de interações.

Os valores atuais devem ser preservados até que testes demonstrem necessidade de alteração.

---

## DEC-005 — Suavização inicial por EMA

**Status:** Substituída pela DEC-011.

**Decisão histórica:**

A implementação inicial utilizava suavização exponencial (EMA) no CursorController, com fator padrão de 0.25.

**Justificativa histórica:**

Reduzir pequenas oscilações na posição do cursor virtual.

**Evolução:**

O EMA foi mantido como referência experimental. Após benchmark sintético e duas rodadas de comparação com câmera real, o One Euro Filter foi escolhido como controlador principal. Os testes do EMA permanecem no projeto para referência e regressão comparativa.

---

## DEC-006 — Motores de interação independentes

**Status:** Adotada.

**Decisão:**

Manter InteractionEngine e ActionEngine separados do PlaygroundEngine.

**Justificativa:**

O processamento de comandos discretos e a manipulação contínua de objetos possuem necessidades diferentes.

O primeiro trabalha com eventos de início e término de gestos. O segundo depende da posição das mãos e da continuidade da pinça.

Uma integração mais explícita poderá ser desenvolvida futuramente, sem exigir a unificação prematura dos motores.

---

## DEC-007 — Playground 2D como ambiente de experimentação

**Status:** Adotada e validada funcionalmente.

**Decisão:**

Desenvolver um ambiente próprio para experimentar interações gestuais.

**Funcionalidades atuais:**

- Seleção de objetos.
- Arraste.
- Redimensionamento proporcional com segunda mão.
- Tolerância de soltura de 150 ms.
- Restrição de objetos aos limites do ambiente.

**Justificativa:**

O Gesture Studio deve evoluir para uma plataforma de experiências interativas, e não apenas um cursor virtual.

---

## DEC-008 — Preservação dos thresholds atuais

**Status:** Adotada.

**Decisão:**

Não alterar thresholds de classificação sem evidência obtida em testes.

**Justificativa:**

Os parâmetros atuais foram testados funcionalmente. Alterações prematuras podem comprometer comportamentos já validados.

---

## DEC-009 — Processamento no navegador

**Status:** Adotada.

**Decisão:**

Manter React, TypeScript, Vite e MediaPipe no ambiente web.

**Justificativa:**

A stack atual permite desenvolver e testar as experiências sem introduzir complexidade adicional de integração nativa.

Uma eventual migração deverá ser justificada por requisitos concretos.

---

## DEC-010 — Validação incremental

**Status:** Adotada.

**Decisão:**

Toda mudança deve ser implementada e validada em etapas pequenas.

**Critérios de validação:**

1. Revisão do código existente.
2. Análise dos riscos da alteração.
3. Implementação isolada.
4. Testes automatizados.
5. Lint e build.
6. Teste com câmera e mãos reais.
7. Regressão das funcionalidades existentes.

**Justificativa:**

Evitar regressões e preservar comportamentos já validados.

---

## DEC-011 — One Euro Filter como controlador principal do cursor

**Status:** Adotada; integração técnica concluída, regressão manual pós-integração pendente.

**Decisão:**

Utilizar OneEuroCursorController como único controlador do cursor virtual e como fonte da posição enviada ao Playground.

Configuração inicial adotada:

- minCutoff: 10.
- beta: 4.
- derivativeCutoff: 1 (valor padrão da implementação).

O EMA não participa mais do processamento principal do cursor. Sua implementação e seus testes são preservados como referência histórica e experimental.

**Justificativa:**

O benchmark sintético mostrou menor erro nos cenários de movimento para a configuração One Euro 10/4, embora o EMA tenha apresentado menor jitter no cenário sintético de mão parada.

Em duas rodadas de comparação com câmera real, o usuário observou melhor estabilidade e responsividade no One Euro. A decisão combina essas evidências, sem tratar o benchmark sintético isoladamente como prova de superioridade universal.

**Critério de validação restante:**

Concluir a regressão com câmera real após a integração, verificando movimentação, arraste, redimensionamento, soltura, perda de tracking e limites do Playground. Não alterar os parâmetros sem evidência.

---

## Pendências técnicas identificadas

Os itens abaixo são observações para revisão futura, não necessariamente defeitos confirmados.

- Avaliar a integração entre ActionEngine e PlaygroundEngine.
- Investigar o threshold `fingerCurled`, declarado mas não utilizado pelo classificador.
- Avaliar o custo de processamento do Canvas e dos estados React por frame.
- Avaliar o ciclo de vida de inicializações repetidas do HandTracker.
- Definir métricas de desempenho e confiabilidade.
- Avaliar processamento em Web Worker.
- Melhorar a organização e a documentação da interface.

Nenhuma dessas pendências deve provocar alterações prematuras em funcionalidades validadas.
