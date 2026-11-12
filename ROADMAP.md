# Roadmap — Gesture Studio

**Versão:** 1.0  
**Referência:** Novembro de 2026

Este documento define a sequência oficial de evolução do Gesture Studio. O desenvolvimento deve respeitar a ordem das fases e os critérios de validação definidos para cada etapa.

O objetivo do projeto é construir uma plataforma própria de interação gestual, natural, precisa, responsiva e confiável, com experiências interativas próprias. O cursor virtual é um mecanismo de interação, não o produto final.

## Princípios de desenvolvimento

- Inspecionar o código real antes de propor mudanças.
- Relacionar cada alteração a uma fase e a um objetivo do roadmap.
- Preservar funcionalidades já validadas.
- Evitar alterar thresholds ou arquitetura sem evidências.
- Implementar mudanças pequenas e isoladas.
- Validar tipos, testes, lint e build.
- Testar com câmera e mãos reais quando a mudança afetar rastreamento ou interação.
- Executar regressões nos recursos existentes.
- Registrar decisões técnicas e problemas identificados.
- Não considerar uma fase concluída apenas porque o projeto compila ou funciona uma vez.

## Fases oficiais

### Fase 1 — Fundação e auditoria técnica

**Status:** Concluída.

Objetivos:

- Auditar a estrutura e a stack existentes.
- Verificar o ciclo de vida da câmera e do rastreamento.
- Revisar os módulos de gestos, interação, ações e Playground.
- Estabelecer testes, lint e build.
- Documentar arquitetura e decisões técnicas.

Critério de saída: fundação revisada, funcionalidades existentes preservadas e documentação técnica inicial estabelecida.

### Fase 2 — Rastreamento e estabilidade

**Status:** Em andamento.

Objetivos:

- Melhorar a estabilidade da posição do cursor.
- Validar o One Euro Filter como controlador principal.
- Definir métricas de desempenho e estabilidade.
- Avaliar o rastreamento em condições variadas.
- Investigar perdas, oscilações e comportamento de lateralidade sem alterar parâmetros sem evidências.

Próximas verificações imediatas:

- Concluir regressão com câmera real após a integração do One Euro.
- Validar movimentação, arraste, redimensionamento, soltura, perda de tracking e limites do Playground.
- Definir e coletar métricas de desempenho.

Critério de saída: rastreamento e posição de interação caracterizados e validados em cenários representativos, com regressões controladas.

### Fase 3 — Reconhecimento inteligente de gestos

Objetivos:

- Evoluir a classificação de gestos.
- Melhorar transições e confiabilidade do reconhecimento.
- Reduzir ativações acidentais.
- Avaliar gestos adicionais somente quando houver necessidade clara de interação.

Critério de saída: conjunto de gestos consistente, testável e adequado às experiências planejadas.

### Fase 4 — Motor de interação

Objetivos:

- Consolidar a tradução de gestos em intenções.
- Definir contratos claros entre eventos discretos e estados contínuos.
- Melhorar o gerenciamento de estados e ações.
- Preservar a separação de responsabilidades entre InteractionEngine, ActionEngine e PlaygroundEngine até que evidências justifiquem mudanças.

Critério de saída: fluxo de interação previsível, modular e validado.

### Fase 5 — Playground 2D avançado

Objetivos:

- Expandir as possibilidades de manipulação 2D.
- Desenvolver interações mais ricas com objetos e componentes.
- Melhorar feedback visual e precisão.
- Validar operações com uma e duas mãos.

Critério de saída: ambiente 2D consistente e suficientemente robusto para servir de base às experiências seguintes.

### Fase 6 — Experiências 3D

Objetivos:

- Introduzir experiências 3D utilizando Three.js.
- Permitir manipulação gestual de objetos tridimensionais.
- Explorar rotação, translação e escala.
- Avaliar interações com uma e duas mãos.

Critério de saída: experiências 3D funcionais, com controles gestuais compreensíveis e desempenho validado.

### Fase 7 — Interface e experiência do usuário

Objetivos:

- Melhorar hierarquia visual e clareza da interface.
- Tornar estados, gestos e ações compreensíveis.
- Criar feedback contextual.
- Melhorar acessibilidade e ergonomia das interações.

Critério de saída: experiência coerente, compreensível e consistente entre os ambientes.

### Fase 8 — Personalização e calibração

Objetivos:

- Avaliar calibração individual.
- Permitir ajustes de sensibilidade e comportamento quando necessário.
- Adaptar a experiência a diferentes condições de uso.
- Evitar expor configurações técnicas desnecessárias ao usuário final.

Critério de saída: mecanismos de calibração e personalização úteis, estáveis e validados.

### Fase 9 — Desempenho, confiabilidade e qualidade

Objetivos:

- Medir e otimizar desempenho.
- Reduzir latência e consumo desnecessário de recursos.
- Melhorar recuperação de falhas.
- Ampliar testes automatizados e regressões.
- Avaliar Web Workers ou outras mudanças arquiteturais somente com evidências.

Critério de saída: qualidade técnica, desempenho e confiabilidade compatíveis com a experiência pretendida.

### Fase 10 — Produto independente e expansão

Objetivos:

- Preparar a aplicação para distribuição e uso independente.
- Revisar instalação, configuração e atualização.
- Consolidar documentação e experiência de produto.
- Avaliar possibilidades de expansão com base nas capacidades validadas.

Critério de saída: versão distribuível, documentada e estável.

## Escopo futuro

Controle global do Windows e integração direta com o sistema operacional não fazem parte do escopo atual das dez fases. Qualquer iniciativa desse tipo exige decisão explícita e replanejamento, sem desviar o desenvolvimento em andamento.

## Protocolo para concluir fases

Uma fase só deve ser considerada concluída após:

1. Objetivos da fase atendidos.
2. Revisão técnica do código.
3. Testes automatizados relevantes aprovados.
4. Lint e build aprovados.
5. Testes reais executados quando aplicáveis.
6. Regressões verificadas.
7. Resultado e decisões documentados.
8. Aprovação explícita do responsável pelo projeto.
