
# Arquitetura — Gesture Studio

## 1. Visão geral

O Gesture Studio utiliza uma arquitetura modular baseada em responsabilidades separadas.

Cada módulo possui uma função específica no processamento da interação gestual. Essa separação facilita manutenção, testes e evolução independente dos componentes.

### Stack principal

- React: interface.
- TypeScript: tipagem e contratos.
- Vite: desenvolvimento e build.
- MediaPipe Tasks Vision: rastreamento das mãos.
- Canvas 2D: renderização visual.
- Vitest: testes automatizados.
- Oxlint: análise estática.

## 2. Organização dos módulos

### `camera/`

Responsável pelo acesso e gerenciamento da câmera.

**CameraManager.ts**

- Inicialização da câmera.
- Gerenciamento do fluxo de vídeo.
- Encerramento da captura.
- Tratamento de operações concorrentes.

### `tracking/`

Responsável pelo rastreamento das mãos.

**HandTracker.ts**

- Inicialização do MediaPipe Hand Landmarker.
- Processamento dos frames de vídeo.
- Extração dos 21 landmarks de cada mão.
- Identificação da lateralidade.
- Encerramento dos recursos do MediaPipe.

**HandLandmarks.ts**

Contém referências e estruturas relacionadas aos landmarks e às conexões anatômicas da mão.

### `gestures/`

Responsável pelo reconhecimento e estabilização dos gestos.

**GestureClassifier.ts**

Classifica os landmarks em gestos reconhecidos.

Gestos implementados:

- PINCH
- OPEN_HAND
- FIST
- UNKNOWN

**GestureEngine.ts**

- Mantém histórico dos gestos.
- Estabiliza classificações ao longo dos frames.
- Emite eventos de início e término.
- Tolera pequenas perdas temporárias de rastreamento.

**GestureTypes.ts**

Define os tipos e contratos relacionados aos gestos.

### `cursor/`

Responsável pelo controle do cursor virtual.

**CursorController.ts**

- Converte a posição de um landmark em coordenadas normalizadas.
- Aplica suavização exponencial (EMA).
- Limita as coordenadas ao intervalo de 0 a 1.
- Permite reinicialização do estado.

### `interaction/`

Responsável por transformar eventos de gestos em intenções de interação.

**InteractionEngine.ts**

Interpreta eventos de início de gesto e produz ações como:

- ACTIVATE_MODE
- SELECT
- CANCEL
- NONE

**InteractionTypes.ts**

Define os contratos das ações de interação.

### `actions/`

Responsável por interpretar e executar as ações recebidas.

**ActionEngine.ts**

- Mantém o estado do modo de interação.
- Ativa e desativa o modo.
- Simula ações de seleção.
- Identifica ações ignoradas.

Atualmente, as ações são simuladas. O motor ainda não representa um sistema geral de execução de comandos externos.

### `playground/`

Responsável pelas interações com objetos do ambiente 2D.

**PlaygroundEngine.ts**

- Mantém os objetos e suas posições.
- Identifica objetos sob o cursor.
- Gerencia seleção e arraste.
- Permite redimensionamento proporcional utilizando uma segunda mão.
- Controla a soltura da interação.
- Restringe os objetos aos limites do ambiente.

### `components/`

Responsável pela integração dos módulos com a interface React.

**HandTrackingView.tsx**

Atualmente funciona como ponto central de integração:

- Gerencia o ciclo de vida da câmera.
- Inicializa e encerra o rastreamento.
- Executa o processamento dos frames.
- Encaminha os resultados aos motores.
- Atualiza o cursor e o Playground.
- Renderiza os resultados visuais.
- Apresenta estados e erros do sistema.

## 3. Fluxo de processamento

O fluxo principal pode ser representado da seguinte maneira:

```text
Câmera
   |
   v
CameraManager
   |
   v
HandTracker
   |
   v
GestureEngine
   |
   +------------------------+
   |                        |
   v                        v
InteractionEngine       CursorController
   |                        |
   v                        v
ActionEngine             PlaygroundEngine
   |                        |
   +------------+-----------+
                |
                v
          Interface React
                |
                v
             Canvas 2D
```

O fluxo representa as responsabilidades gerais. A integração efetiva entre os motores é realizada atualmente pelo componente `HandTrackingView.tsx`.

## 4. Modelagem de gestos e interações

O projeto utiliza duas formas complementares de representar a intenção do usuário.

### Eventos discretos

O GestureEngine emite eventos:

- GESTURE_STARTED
- GESTURE_ENDED

Esses eventos são processados pelo InteractionEngine e posteriormente pelo ActionEngine.

São utilizados para ações como ativar e desativar o modo de interação.

### Estados contínuos

O Playground utiliza o estado estabilizado do gesto PINCH em conjunto com a posição das mãos.

Isso permite identificar:

- Início de seleção.
- Continuidade do arraste.
- Perda temporária da pinça.
- Confirmação da soltura.
- Redimensionamento com uma segunda mão.

Esses caminhos são complementares e não devem ser unificados sem uma justificativa arquitetural.

## 5. Ciclo de vida e tratamento de erros

O processamento depende de recursos externos, principalmente câmera e MediaPipe.

Por isso, o sistema precisa controlar:

- Inicialização dos recursos.
- Cancelamento do processamento.
- Encerramento da câmera.
- Liberação dos recursos do MediaPipe.
- Prevenção de operações concorrentes obsoletas.
- Tratamento de falhas consecutivas no processamento.

Atualmente, o processamento interrompe o rastreamento após três falhas consecutivas, apresentando o estado de erro na interface.

## 6. Testes e qualidade

O projeto utiliza Vitest para testes automatizados.

Comandos:

```bash
npm run test:run
npm run lint
npm run build
```

Testes automatizados não substituem a validação com câmera e mãos reais.

Mudanças relacionadas a rastreamento, gestos e interação devem ser verificadas também em execução real.

## 7. Evolução arquitetural

As próximas evoluções devem preservar a separação de responsabilidades.

Possíveis melhorias:

- Avaliar One Euro Filter para suavização adaptativa.
- Definir métricas de desempenho.
- Tornar mais explícito o contrato entre intenções de interação e operações do Playground.
- Expandir as experiências 2D.
- Introduzir experiências 3D com Three.js.
- Melhorar calibração e personalização.
- Avaliar processamento em Web Worker mediante evidências de desempenho.

Essas melhorias não devem ser implementadas antes da validação de sua necessidade e impacto.
