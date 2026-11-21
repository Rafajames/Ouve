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
