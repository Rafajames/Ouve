# 15 — Backlog inicial de implementação

O backlog foi reorganizado para iniciar implementação sem exigir validação manual imediata. Itens dependentes de plataforma devem ter adaptadores, testes automatizados possíveis e status explícito de não validados.

## EPIC 0 — Fundação e scaffold
- [x] Consolidar decisões de produto: captura selecionada, processamento exclusivamente de áudio, IA extensível e BYOK.
- [x] Criar monorepo pnpm e TypeScript estrito.
- [x] Criar pacotes compartilhados de domínio e contratos iniciais.
- [x] Criar scaffold Electron + React para Windows.
- [x] Criar scaffold WebExtension para Chrome/Firefox.
- [x] Configurar typecheck, testes e CI; lint (ESLint) e Prettier configurados em 21/11/2026.
- [x] Documentar comandos de desenvolvimento e arquitetura.

## EPIC 1 — Núcleo compartilhado
- [x] Tipos iniciais de Session, CaptureSource, AudioChunk, TranscriptSegment, Speaker e Report; schemas de validação ainda pendentes.
- [x] Máquina de estados inicial da sessão.
- [x] Contratos iniciais de captura, transcrição, diarização e análise.
- [x] Contratos de armazenamento temporário (SecretStore, TranscriptStore) e exportação (reports).
- [x] Normalização de timestamps e segmentos (offset por bloco, ordenação, idempotência).
- [x] Validação de saídas de IA e evidências.
- [x] Fronteira utilitária que mantém trilhas de áudio e interrompe trilhas não áudio, com testes.

## EPIC 2 — Captura exclusivamente de áudio
- [x] Seleção explícita de tela, janela (desktop) ou aba (extensão Chrome) — implementada, não validada em hardware.
- [x] Capturar apenas a trilha de áudio da fonte selecionada — implementado; no Windows o áudio é do sistema inteiro (P-030).
- [x] Utilitário defensivo para descartar trilhas não áudio imediatamente.
- [x] Microfone opcional e mixagem (volumes independentes, silenciar microfone).
- [x] Indicador persistente (faixa no app, título da janela, barra de tarefas), pausa, retomada e parada.
- [x] Adaptadores separados para Electron/Windows, Chrome e Firefox.
- [x] Detecção de ausência de áudio e mensagens de compatibilidade.
- [ ] Testes de integração em ambiente real quando disponível.
- [x] Escopo visual excluído: não implementar gravação de tela, OCR, visão computacional ou pipeline A/V.

## EPIC 3 — Arquivos e pipeline de áudio
- [x] Importar áudio e vídeo.
- [x] Extrair somente áudio de arquivos de vídeo (ffmpeg -vn; testado com MP4 gerado).
- [x] Validar extensão, tamanho, duração e presença de faixa de áudio.
- [x] Segmentação para arquivos longos e limites dos provedores.
- [x] Progresso, cancelamento e tratamento de erros.
- [x] Armazenamento temporário e descarte.

## EPIC 4 — Provedores de IA
- [x] Contratos comuns iniciais para provedores de transcrição e análise.
- [x] Adaptadores para OpenAI, Gemini, Claude e Grok conforme capacidades (não validados com chaves reais).
- [x] Suporte genérico a endpoint compatível com API OpenAI (testado com servidor local falso).
- [x] Configuração de provedor personalizado: nome, URL, modelo, autenticação e cabeçalhos.
- [x] Separação conceitual de tarefas e capacidades de provedores.
- [x] Cofre local para chaves BYOK (safeStorage no desktop; perfil do navegador na extensão).
- [x] Teste de conexão e indicação de capacidades/limitações.
- [x] Registro extensível de adaptadores; seleção de provedor por tarefa (transcrição × análise).

## EPIC 5 — Transcrição e participantes
- [x] Transcrição incremental e pós-processamento.
- [x] Timestamps e ordenação.
- [x] Diarização quando suportada pelo provedor (mapeamento entre blocos aproximado).
- [x] Rótulos editáveis para participantes.
- [x] Correção manual de transcrição (desktop).
- [x] Indicadores de baixa confiança quando fornecidos.

## EPIC 6 — Análise e relatórios
- [x] Resumo geral.
- [x] Tópicos (subtópicos pendentes).
- [x] Perguntas e respostas.
- [x] Decisões, pendências, pontos de atenção e encaminhamentos.
- [x] Tarefas, responsáveis e prazos somente quando mencionados nos trechos citados.
- [x] Evidências vinculadas aos trechos da transcrição.
- [x] Editor de relatório (completo no desktop; simplificado na extensão).
- [x] Exportação local PDF/DOCX (e Markdown).

## EPIC 7 — Qualidade, segurança e distribuição
- [x] Testes unitários, integração e E2E (Electron e extensão) — ampliar com hardware real.
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

## Novos itens — 21/11/2026
- [ ] Validar captura real no Windows (tela, janela, microfone, combinação) e registrar evidências (P-020).
- [ ] Validar captura de aba no Chrome e microfone no Firefox (P-021).
- [ ] Validar provedores com chaves reais e amostras autorizadas em pt-BR (P-027).
- [ ] Áudio por processo no Windows via módulo nativo (P-030).
- [ ] Migrar ScriptProcessor para AudioWorklet (P-031).
- [ ] Fonte TTF no PDF para caracteres fora do WinAnsi (P-032).
- [ ] Revisão de licenciamento do ffmpeg antes de distribuir (P-029).
- [ ] Gerar e testar instalador NSIS e assinatura (P-033).
- [ ] Carregamento sob demanda dos exportadores para reduzir o bundle do renderer (~1,5 MB).
- [ ] Transcrição em streaming (WebSocket/Realtime) para menor latência que blocos de 20 s.
- [ ] Fichas de política de dados por provedor (P-035).
- [x] Ícones, tema claro/escuro e layout da sessão com painel lateral (21/11/2026).
- [ ] Revisar contraste WCAG AA dos dois temas com ferramenta dedicada.

## Novos itens — 22/11/2026
- [x] Métricas locais, marcadores, avisos discretos, relatório 2.0, TXT/CSV, chaves só na sessão, IA local detectada, apresentação e Ajuda (D-072–D-081).
- [x] Transcrição local com um clique no desktop (whisper.cpp embutido, modelo baixado pela interface) e instalação do Ollama pelo Ouve (D-082).
- [ ] Validar no Windows real: whisper-server embutido, modelos, desempenho por hardware e instalador do Ollama (P-039).
- [ ] **Melhoria futura (sem data — pedido do James em 22/11/2026):** Whisper dentro do próprio Ouve, sem instalar nada (Transformers.js + WebGPU/WASM), funcionando também na web e na extensão. Custos: download de 40 MB a 1,5 GB na primeira vez e lentidão em PCs modestos em gravações longas; sem separação de vozes. Ideia de uso: “modo privado” para arquivos curtos.
- [ ] Separação de vozes (diarização) local — hoje só provedores externos separam participantes.
