# 04 — Roadmap

O roadmap é incremental. As etapas não significam que os recursos estejam implementados.

## Fase 0 — Fundação e validação técnica
- [ ] Confirmar stack, build e estrutura do projeto.
- [ ] Criar scaffold WebExtensions para Chrome e Firefox.
- [ ] Definir convenções, lint, typecheck e testes.
- [ ] Fazer spike de importação e leitura de arquivos de áudio/vídeo.
- [ ] Comparar provedores de transcrição e análise (idioma, custo, limites, diarização, timestamps, privacidade).
- [ ] Selecionar primeiro provedor por decisão registrada.

**Saída:** extensão mínima compilando nos dois navegadores e decisão técnica fundamentada.

## Fase 1 — MVP de gravações
- [ ] Interface de importação.
- [ ] Validação e preparação de mídia.
- [ ] Configuração BYOK.
- [ ] Integração com primeiro provedor de transcrição.
- [ ] Normalização da transcrição e timestamps.
- [ ] Rotulagem de falantes quando suportada.
- [ ] Análise de tópicos, decisões, tarefas e pendências.
- [ ] Resumo e relatório completo.
- [ ] Revisão e edição manual.
- [ ] Exportação PDF e DOCX.
- [ ] Descarte de sessão e testes de privacidade.

**Saída:** usuário consegue transformar uma gravação em relatório exportável.

## Fase 2 — Experiência e robustez
- [ ] Melhorar tratamento de arquivos longos.
- [ ] Divisão em blocos e consolidação.
- [ ] Retomada segura após falha, sem histórico permanente.
- [ ] Melhorias de acessibilidade e experiência.
- [ ] Testes ampliados em Chrome e Firefox.
- [ ] Otimização de memória e desempenho.

## Fase 3 — Acompanhamento ao vivo
- [ ] Spike de captura de áudio de aba no Chrome.
- [ ] Spike equivalente no Firefox.
- [ ] Avaliar microfone e fontes disponíveis.
- [ ] Indicador persistente, pausa, retomada e encerramento.
- [ ] Transcrição incremental.
- [ ] Organização progressiva de tópicos.
- [ ] Relatório final e descarte.

## Fase 4 — Evoluções sujeitas a decisão
- [ ] Configurações de modelos e provedores adicionais.
- [ ] Modelos de relatório por contexto de uso.
- [ ] Mais idiomas.
- [ ] Recursos de pesquisa e navegação em transcrições.
- [ ] Outras integrações, somente após análise de privacidade e custo.

## Critério para avançar de fase
Cada fase deve ter critérios de aceite, testes, limitações documentadas e decisão registrada. Não avançar com base apenas em demonstração visual.


## Atualização de roadmap — desktop e captura externa (20/11/2026)

### Fase 0A — Plataforma desktop
- [ ] Comparar Electron e Tauri para Windows: captura de janela/monitor, áudio de sistema, empacotamento, consumo, tamanho e manutenção.
- [ ] Definir arquitetura compartilhada entre desktop e extensão.
- [ ] Validar estratégia de distribuição/instalador Windows.

### Fase 0B — Provas de conceito de captura
- [ ] Extensão Chrome: seleção de aba/tela e captura de áudio compatível.
- [ ] Extensão Firefox: mapear APIs e limitações.
- [ ] Desktop Windows: selecionar monitor/janela externa e validar captura de áudio do sistema.
- [ ] Testar vídeo reproduzido em aplicativo externo, múltiplos monitores e tela dividida.
- [ ] Validar sincronização A/V, troca de fonte e descarte de buffers.

O MVP passa a manter desktop e extensão em escopo, com incrementos verificáveis. Importação de arquivo continua disponível; captura externa será modalidade separada, sem exigir reprodução dentro do Ouve.


## Atualização — 21/11/2026
Implementado em código (ver docs/06 para evidências e o que falta validar): fundação do monorepo com lint/format/typecheck/testes/CI; importação com extração de áudio; BYOK com cofre local; adaptadores OpenAI, Gemini, Claude, Grok, compatíveis e personalizados; transcrição com timestamps e falantes quando o provedor oferece; análise validada; relatório editável; exportação PDF/DOCX; captura desktop e extensão Chrome por adaptadores. Os itens das fases acima permanecem desmarcados até a validação com plataformas e provedores reais.
