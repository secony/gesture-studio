# Gesture Studio

Plataforma de interação natural por gestos utilizando visão computacional e rastreamento das mãos em tempo real.

O Gesture Studio explora novas formas de interação entre pessoas e interfaces digitais, permitindo controlar elementos visuais por meio de movimentos e gestos das mãos. O objetivo é evoluir para uma plataforma de experiências interativas próprias, não apenas um cursor virtual.

## Tecnologias

- React 19
- TypeScript 7
- Vite 8
- MediaPipe Tasks Vision
- Canvas 2D
- Vitest
- Oxlint

## Funcionalidades atuais

- Rastreamento de até duas mãos.
- Classificação de gestos básicos: PINCH, OPEN_HAND, FIST e UNKNOWN.
- Estabilização temporal dos gestos.
- Cursor virtual controlado pelo One Euro Filter.
- Motor de interação para eventos discretos.
- Playground 2D com seleção, arraste e redimensionamento proporcional de objetos.

### Suavização do cursor

O controlador principal utiliza o One Euro Filter, com configuração inicial:

- `minCutoff: 10`
- `beta: 4`
- `derivativeCutoff: 1` (padrão)

O One Euro ajusta a suavização conforme a velocidade do movimento, buscando equilibrar estabilidade e responsividade. A implementação anterior baseada em EMA permanece no código e nos testes como referência experimental, mas não controla o cursor no fluxo principal.

## Requisitos

- Node.js compatível com a versão do Vite utilizada.
- npm.
- Navegador com suporte à API de câmera.
- Webcam.
- Permissão para acessar a câmera.
- Conexão com a internet para carregar os recursos WASM do MediaPipe.

## Instalação

Clone o repositório e acesse a pasta:

```bash
git clone https://github.com/secony/gesture-studio.git
cd gesture-studio
```

Instale as dependências:

```bash
npm install
```

## Desenvolvimento

Inicie o servidor local:

```bash
npm run dev
```

O Vite disponibilizará o endereço local no terminal.

## Validação

Execute os testes automatizados:

```bash
npm run test:run
```

Execute o lint:

```bash
npm run lint
```

Gere a versão de produção:

```bash
npm run build
```

Para visualizar a versão de produção:

```bash
npm run preview
```

## Estrutura do projeto

```text
src/
├── actions/       # Execução das ações de interação
├── assets/        # Recursos estáticos
├── camera/        # Gerenciamento da câmera
├── components/    # Componentes da interface
├── cursor/        # Filtros e controle do cursor virtual
├── gestures/      # Classificação e estabilização dos gestos
├── interaction/   # Tradução de gestos em intenções
├── playground/    # Interações com objetos 2D
├── tracking/      # Rastreamento das mãos
├── App.tsx
├── main.tsx
├── App.css
└── index.css

tests/             # Testes automatizados
public/            # Recursos públicos
```

## Arquitetura e decisões

- [Arquitetura](./ARCHITECTURE.md)
- [Decisões técnicas](./DECISIONS.md)
- [Roadmap](./ROADMAP.md)

## Estado do projeto

O projeto está em desenvolvimento incremental. A Fase 1 — Fundação e auditoria técnica — foi concluída. A Fase 2 — Rastreamento e estabilidade — está em andamento.

A integração do One Euro Filter passou por testes automatizados, lint e build. A regressão manual com câmera real após sua integração ainda precisa ser concluída antes de considerar essa etapa validada.

O desenvolvimento segue um roadmap de dez fases, priorizando estabilidade, confiabilidade e evolução gradual da experiência de interação.

## Observação

Este projeto ainda não representa uma versão final de produto. Interfaces, motores e experiências podem evoluir conforme as etapas de desenvolvimento e validação.
