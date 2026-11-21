# 08 — Arquitetura detalhada e contratos

## 1. Princípios
1. Domínio sem dependência de Electron, React, Chrome, Firefox ou fornecedor de IA.
2. Portas definem contratos; adaptadores implementam integrações.
3. Áudio, vídeo, captura de quadros e transcrição são fluxos distintos com timestamps.
4. Falhas de captura não podem ser mascaradas como sucesso.
5. Processamento temporário por padrão; exportação é ação do usuário.
6. Saídas de IA são dados não confiáveis e passam por validação.

## 2. Componentes
- **Domain:** Session, CaptureSource, MediaChunk, TranscriptSegment, Speaker, Topic, Decision, ActionItem, Report.
- **Application:** StartSession, SelectCaptureSource, PauseCapture, ResumeCapture, StopSession, ImportMedia, Transcribe, AnalyzeTranscript, AnalyzeVisualContext, BuildReport, ExportReport, DiscardSession.
- **Ports:** CaptureSourcePort, AudioInputPort, VideoFramePort, MediaFilePort, TranscriptionPort, AnalysisPort, TemporarySessionRepository, ReportExportPort, SecretStorePort, ClockPort, LoggerPort.
- **Adapters:** ElectronCaptureAdapter, WebExtensionCaptureAdapter, ChromeAdapter, FirefoxAdapter, FileMediaAdapter, ProviderAdapters, PdfExporter, DocxExporter.
- **UI:** dashboard, capture wizard, live workspace, transcript editor, report editor, settings, provider configuration.

## 3. Contratos conceituais
`CaptureSource`: id efêmero, tipo (screen/window/tab/microphone/file), rótulo exibido, capacidades (video/audio), origem de áudio, restrições e permissões.

`MediaChunk`: sessionId, sequence, startTimeMs, endTimeMs, mediaType, mimeType, payload temporário e sourceId. Não incluir conteúdo bruto em logs.

`TranscriptSegment`: id, startMs, endMs, text, speakerId opcional, confidence opcional, sourceAudioId opcional.

`VisualObservation`: timestampMs, descrição/elementos relevantes extraídos de quadro, referência temporária ao quadro se necessária; não persistir screenshot sem ação explícita.

`Topic`: id, title, summary, startMs, endMs, evidenceSegmentIds, confidence.

`Decision`: id, description, status (confirmed/proposed/uncertain), evidenceSegmentIds, timestamp.

`ActionItem`: id, description, ownerMentioned?, dueDateMentioned?, status, evidenceSegmentIds.

`Report`: sessionId, title, executiveSummary, topics, decisions, actionItems, openQuestions, transcriptReference, generatedAt.

## 4. Pipeline ao vivo
Fonte selecionada → captura de áudio/vídeo → normalização e relógio comum → segmentação de áudio → transcrição incremental → análise textual → amostragem de quadros → observações visuais → associação temporal → atualização de tópicos → consolidação final.

Não enviar cada quadro indiscriminadamente para um modelo multimodal. Definir política de amostragem por mudança de cena, intervalo e contexto, com limites de custo/CPU e opção de desativar análise visual.

## 5. Sincronização
Cada bloco de áudio e quadro recebe timestamp monotônico relativo à sessão e, quando disponível, timestamp do sistema. Registrar drift e lacunas. A interface deve indicar quando áudio/vídeo não estão sincronizados ou quando uma fonte não fornece timestamp confiável.

## 6. Providers
`TranscriptionPort` recebe áudio/arquivo ou segmentos e retorna segmentos normalizados, idioma, timestamps, diarização disponível, limites e metadados do provedor.

`AnalysisPort` recebe transcrição e observações visuais minimizadas, instruções de saída e esquema versionado; retorna JSON validado. O provedor não deve controlar fluxo de aplicação nem executar comandos.

Cada adaptador documenta: endpoint, autenticação, modelos, limites, idiomas, custo, retenção, região, política de treinamento, streaming, diarização, timestamps, cancelamento e tratamento de erros.

## 7. Segurança entre processos
No Electron, renderer sem Node integration; context isolation habilitado; preload com API mínima tipada; IPC com allowlist e validação de payload; permissões de captura explícitas. Nunca expor filesystem, shell, segredos ou IPC genérico ao renderer.

Na extensão, permissões mínimas, content scripts isolados, validação de mensagens e nenhuma permissão ampla sem justificativa.

## 8. Armazenamento
Sem conta, backend próprio ou histórico permanente no MVP. Buffers em memória/temporários com limites; limpeza no encerramento/cancelamento. Segredos separados do conteúdo da sessão. O usuário exporta o relatório e decide onde salvar. Informar que o provedor externo pode ter retenção própria.

## 9. Tratamento de falhas
Estados tipados: idle, requesting-permission, capturing, paused, processing, finalizing, completed, failed, cancelled. Toda operação longa aceita cancelamento. Falha de provedor não deve apagar o material temporário ainda em sessão; oferecer retry ou descarte, sem persistir por padrão.
