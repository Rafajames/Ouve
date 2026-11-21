# 07 — Blueprint de desenvolvimento

**Status:** especificação-base para iniciar a implementação, com provas técnicas obrigatórias identificadas.

## 1. Produto a construir
Ouve é um assistente privado de acompanhamento e análise de reuniões, audiências e gravações. Terá:
- aplicativo desktop instalável, Windows como primeira plataforma;
- extensão para Chrome e Firefox;
- análise de arquivos importados;
- captura ao vivo de aba/tela/janela, quando suportada;
- análise de conteúdo visual e áudio, com fontes identificadas;
- transcrição, tópicos, decisões, perguntas/respostas, tarefas, responsáveis e prazos mencionados;
- revisão humana e exportação local PDF/DOCX.

A captura de tela é uma fonte de entrada do próprio Ouve. Não é transmissão para participantes nem videoconferência.

## 2. Modos de uso
**Modo A — Arquivo:** usuário seleciona arquivo local; Ouve valida, extrai/prepara áudio, transcreve, analisa e gera relatório.

**Modo B — Captura externa:** usuário mantém a audiência/vídeo em outro monitor, tela dividida ou aplicativo (ex.: VLC), escolhe a tela/janela no Ouve e inicia a análise. Não precisa importar nem reproduzir o vídeo dentro do Ouve.

**Modo C — Aba do navegador:** usuário escolhe uma aba compatível ou abre a extensão na aba da audiência. Captura de áudio depende da API e permissões disponíveis.

**Modo D — Microfone:** opção explícita para capturar áudio ambiente, quando necessária e autorizada. Não substitui captura digital de áudio do sistema.

## 3. Jornada principal de captura
1. Abrir Ouve e escolher “Acompanhar ao vivo”.
2. Escolher a origem: tela/monitor, janela, aba ou microfone (fontes apresentadas conforme o ambiente).
3. Ver resumo de quais sinais serão capturados: vídeo, áudio da aba, áudio do sistema/loopback, microfone.
4. Confirmar permissões do navegador/SO.
5. Iniciar; exibir estado de captura persistente.
6. Processar áudio em segmentos e amostrar quadros visuais em frequência configurável.
7. Exibir transcrição incremental e tópicos em evolução.
8. Permitir pausar, retomar, trocar fonte quando seguro e encerrar.
9. Ao encerrar, consolidar relatório, permitir revisão/exportação e descartar dados temporários.

## 4. Requisitos de qualidade do resultado
- Toda decisão, tarefa ou afirmação relevante deve apontar trecho e timestamp quando disponíveis.
- Separar citação/transcrição, resumo e inferência.
- Marcar incerteza e informação não identificada; nunca completar lacunas por suposição.
- Rótulos de falantes neutros (Falante 1 etc.); não reconhecer identidade biométrica.
- Usuário pode corrigir transcrição, rótulos e relatório antes de exportar.

## 5. Arquitetura de produto
Aplicações: `apps/desktop`, `apps/extension`.
Pacotes compartilhados: `packages/domain`, `packages/application`, `packages/contracts`, `packages/media`, `packages/providers`, `packages/reporting`, `packages/ui` (se viável).
Testes: próximos de cada pacote e em `tests/e2e`.

A adoção de monorepo e ferramenta de workspace deve ser confirmada no bootstrap. O princípio obrigatório é separar domínio/casos de uso dos adaptadores de plataforma.

## 6. Decisões técnicas recomendadas
- Linguagem: TypeScript estrito para núcleo e interfaces.
- Interface: React.
- Extensão: WebExtensions, com adaptadores por navegador e manifests separados quando necessário.
- Desktop: Electron é a opção inicial recomendada para spike, pela maturidade do ecossistema Chromium/Node e ferramentas de captura; comparar com Tauri antes de fixar. A recomendação não substitui teste de captura de áudio do sistema.
- Validação: Zod ou biblioteca equivalente para dados externos e saídas estruturadas.
- Testes: Vitest para unidade/integração; Playwright para UI/E2E onde compatível.
- Qualidade: ESLint, Prettier, TypeScript, CI GitHub Actions.
- Relatórios: avaliar bibliotecas mantidas para PDF e DOCX; exportação local.

## 7. Limites conhecidos
Capturar a imagem de uma janela não garante obter o áudio produzido por ela. Áudio digital pode exigir captura da aba, loopback do sistema ou API específica. Conteúdo DRM/protegido, janelas minimizadas, políticas de videoconferência e diferenças entre Chrome/Firefox podem impedir captura. A interface deve informar o que está realmente sendo capturado.

## 8. Pronto para começar quando
- Ambiente e estrutura de monorepo escolhidos.
- Provas de conceito mínimas de captura em Windows/Chrome/Firefox registradas.
- Primeiro provedor escolhido após comparação de preço, qualidade, retenção e termos.
- Esquema de sessão/transcrição/relatório validado.
- Fluxos de privacidade, consentimento, pausa e descarte testados.
- Backlog inicial priorizado e critérios de aceite aprovados.
