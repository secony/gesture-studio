
# Gesture Studio

Plataforma de interação natural por gestos utilizando visão computacional e rastreamento das mãos em tempo real.

O Gesture Studio explora novas formas de interação entre pessoas e interfaces digitais, permitindo controlar elementos visuais por meio de movimentos e gestos das mãos.

## Tecnologias

- React 19
- TypeScript 7
- Vite 8
- MediaPipe Tasks Vision
- Canvas 2D
- Vitest
- Oxlint

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
git clone <URL_DO_REPOSITORIO>
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
├── cursor/        # Controle do cursor virtual
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

## Arquitetura

O processamento é organizado em módulos especializados:

1. Captura da imagem da câmera.
2. Rastreamento das mãos com MediaPipe.
3. Classificação e estabilização dos gestos.
4. Tradução dos gestos em intenções de interação.
5. Execução de ações e atualização das experiências interativas.
6. Renderização dos elementos visuais.

Consulte [ARCHITECTURE.md](./ARCHITECTURE.md) para conhecer os módulos e o fluxo de processamento.

## Estado do projeto

O projeto está em desenvolvimento incremental.

As funcionalidades atuais incluem:

- Rastreamento de até duas mãos.
- Classificação de gestos básicos.
- Estabilização temporal dos gestos.
- Cursor virtual com suavização.
- Motor de interação.
- Playground 2D com seleção, arraste e redimensionamento proporcional de objetos.

O desenvolvimento segue um roadmap técnico dividido em fases, priorizando estabilidade, confiabilidade e evolução gradual da experiência de interação.

## Documentação

- [Arquitetura](./ARCHITECTURE.md)
- [Decisões técnicas](./DECISIONS.md)

## Observação

Este projeto ainda não representa uma versão final de produto. Interfaces, motores e experiências podem evoluir conforme as etapas de desenvolvimento e validação.
