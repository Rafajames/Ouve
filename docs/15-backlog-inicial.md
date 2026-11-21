# 15 — Backlog inicial de implementação

Este backlog orienta o início do desenvolvimento. Cada item deve virar issue/PR pequena com critérios de aceite.

## EPIC 0 — Decisões e bootstrap
- [ ] Validar tecnologia desktop (Electron vs Tauri) com spike de captura.
- [ ] Validar estrutura monorepo e gerenciador de pacotes.
- [ ] Escolher primeiro provedor de transcrição/análise por matriz comparativa.
- [ ] Definir formatos de arquivo e limites do MVP.
- [ ] Definir identidade visual e componentes de UI.
- [ ] Criar scaffold e CI.

## EPIC 1 — Núcleo compartilhado
- [ ] Criar modelos de domínio e schemas versionados.
- [ ] Implementar máquina de estados da sessão.
- [ ] Implementar armazenamento temporário e descarte.
- [ ] Implementar normalização de timestamps e segmentos.
- [ ] Implementar validação de saída de IA e evidências.

## EPIC 2 — Aplicativo desktop
- [ ] Janela principal e navegação.
- [ ] Preload/IPC seguro se Electron.
- [ ] Seleção de monitor/janela.
- [ ] Spike de áudio de sistema/loopback.
- [ ] Indicador, pausa, retomada e parada.
- [ ] Empacotamento Windows.

## EPIC 3 — Extensão
- [ ] Scaffold Chrome e Firefox.
- [ ] Popup e tela completa.
- [ ] Captura de aba/tela com seleção explícita.
- [ ] Testes de áudio por navegador.
- [ ] Mensageria segura entre popup/background/content scripts.
- [ ] Pacotes de build para carregamento local.

## EPIC 4 — Arquivos e transcrição
- [ ] Seletor e validação de arquivos.
- [ ] Extração/preparação de áudio.
- [ ] Adaptador do primeiro provedor.
- [ ] Progresso, cancelamento e erros.
- [ ] Diarização quando suportada.

## EPIC 5 — Análise e relatórios
- [ ] Tópicos com evidências.
- [ ] Decisões, perguntas/respostas, tarefas e prazos.
- [ ] Resumo executivo e relatório completo.
- [ ] Editor de transcrição e relatório.
- [ ] Exportação PDF/DOCX.

## EPIC 6 — Captura multimodal ao vivo
- [ ] Pipeline de áudio em blocos.
- [ ] Transcrição incremental.
- [ ] Amostragem e análise visual.
- [ ] Sincronização A/V.
- [ ] Consolidação final e descarte.

## EPIC 7 — Qualidade e lançamento
- [ ] Testes unitários, integração e E2E.
- [ ] Revisão de segurança e permissões.
- [ ] Testes de consumo em sessões longas.
- [ ] Política de privacidade e termos revisados.
- [ ] Assinatura e distribuição do instalador.
- [ ] Empacotamento e publicação das extensões.
