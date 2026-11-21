# 15 — Backlog inicial de implementação

O backlog foi reorganizado para iniciar implementação sem exigir validação manual imediata. Itens dependentes de plataforma devem ter adaptadores, testes automatizados possíveis e status explícito de não validados.

## EPIC 0 — Fundação e scaffold
- [x] Consolidar decisões de produto: captura selecionada, processamento exclusivamente de áudio, IA extensível e BYOK.
- [ ] Criar monorepo pnpm e TypeScript estrito.
- [ ] Criar pacotes compartilhados de domínio e contratos.
- [ ] Criar scaffold Electron + React para Windows.
- [ ] Criar scaffold WebExtension para Chrome/Firefox.
- [ ] Configurar lint, typecheck, testes e CI.
- [ ] Documentar comandos de desenvolvimento e arquitetura.

## EPIC 1 — Núcleo compartilhado
- [ ] Modelos e schemas versionados: Session, CaptureSource, AudioChunk, TranscriptSegment, Speaker, Topic, Decision, ActionItem e Report.
- [ ] Máquina de estados da sessão.
- [ ] Contratos de captura, armazenamento temporário, transcrição, diarização, análise e exportação.
- [ ] Normalização de timestamps e segmentos.
- [ ] Validação de saídas de IA e evidências.
- [ ] Descarte seguro e cancelamento.

## EPIC 2 — Captura exclusivamente de áudio
- [ ] Seleção explícita de tela, janela ou aba.
- [ ] Capturar apenas a trilha de áudio da fonte selecionada.
- [ ] Descartar imediatamente qualquer quadro visual exigido pela API de seleção.
- [ ] Microfone opcional e mixagem configurável.
- [ ] Indicador persistente, pausa, retomada e parada.
- [ ] Adaptadores separados para Electron/Windows, Chrome e Firefox.
- [ ] Detecção de ausência de áudio e mensagens de compatibilidade.
- [ ] Testes de integração em ambiente real quando disponível.
- [ ] Não implementar gravação de tela, OCR, visão computacional ou pipeline A/V.

## EPIC 3 — Arquivos e pipeline de áudio
- [ ] Importar áudio e vídeo.
- [ ] Extrair somente áudio de arquivos de vídeo.
- [ ] Validar MIME, extensão, tamanho e duração.
- [ ] Segmentação para arquivos longos e limites dos provedores.
- [ ] Progresso, cancelamento e tratamento de erros.
- [ ] Armazenamento temporário e descarte.

## EPIC 4 — Provedores de IA
- [ ] Interface comum para provedores de transcrição.
- [ ] Adaptadores oficiais para OpenAI, Gemini, Claude e Grok conforme APIs/capacidades disponíveis.
- [ ] Suporte genérico a endpoint compatível com API OpenAI.
- [ ] Configuração de provedor personalizado: nome, URL, modelo, autenticação e capacidades.
- [ ] Separar transcrição, diarização e análise textual.
- [ ] Cofre local para chaves BYOK.
- [ ] Teste de conexão e indicação de capacidades/limitações.
- [ ] Seleção de provedores por tarefa.

## EPIC 5 — Transcrição e participantes
- [ ] Transcrição incremental e pós-processamento.
- [ ] Timestamps e ordenação.
- [ ] Diarização quando suportada.
- [ ] Rótulos editáveis para participantes.
- [ ] Correção manual de transcrição.
- [ ] Indicadores de confiança/incerteza quando fornecidos.

## EPIC 6 — Análise e relatórios
- [ ] Resumo executivo e detalhado.
- [ ] Tópicos e subtópicos.
- [ ] Perguntas e respostas.
- [ ] Decisões e encaminhamentos.
- [ ] Tarefas, responsáveis e prazos somente quando mencionados ou marcados como não identificados.
- [ ] Evidências vinculadas aos trechos da transcrição.
- [ ] Editor de relatório.
- [ ] Exportação local PDF/DOCX.

## EPIC 7 — Qualidade, segurança e distribuição
- [ ] Testes unitários, integração e E2E.
- [ ] Revisão de permissões e segurança.
- [ ] Testes de sessões longas e consumo de memória.
- [ ] Revisão de política de privacidade e termos.
- [ ] Empacotamento e assinatura Windows.
- [ ] Pacotes de distribuição Chrome e Firefox.

## Fora do MVP
- Contas, login e sincronização.
- Backend próprio e histórico em nuvem.
- Analytics de conteúdo.
- Captura ou análise visual, OCR e gravação de tela.
- Aplicativo mobile.
- Servidor MCP público.
