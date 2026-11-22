# 17 — Auditoria do projeto real e plano de evolução

**Data:** 22/11/2026 · **Base auditada:** branch `desenvolvimento/mvp` (commit `3f03697`) · **Referência:** video-db/call.md (MIT)

## 1. A divergência entre o código publicado e a versão testada — resolvida

| Branch | Conteúdo | Situação |
|---|---|---|
| `main` | Só o scaffold de 20/11 (54 arquivos, captura desabilitada na interface) | **19 commits atrás** — nenhum commit próprio |
| `desenvolvimento/mvp` | MVP funcional de 21/11 (≈13 mil linhas, 7 pacotes + 3 apps) | É a versão que gera o **instalador (Releases)** e a **versão web (gh-pages)** |
| `gh-pages` | Build da web a partir de `3f03697` | Publicada |

**Conclusão:** a inspeção anterior olhou a `main`; os testes do James usaram o instalador e a web gerados de `desenvolvimento/mvp`. Não há duas implementações concorrentes — a `main` é apenas um ancestral. A `main` pode ser avançada por *fast-forward* sem perda (nenhum commit exclusivo nela).

Alterações locais não commitadas no computador do James: **não verificadas** (nenhuma pasta local foi conectada a esta sessão).

## 2. Verificação automática executada nesta auditoria
- `pnpm lint` ✔ · `pnpm typecheck` ✔ · `pnpm test` ✔ — **96 testes unitários passando** (shared 10, core 12, analysis 6, capture 13, providers 22, reports 4, transcription 6, web 4, extension 5, desktop 14).
- E2E (Electron/Chromium) não executados aqui; constam como passando no CI segundo `docs/06`.
- Validado pelo James em uso real (relato, não reproduzido aqui): captura, chave Gemini, transcrição, diarização, relatório inicial.

## 3. Inventário — o que existe

| Área | Estado | Observações |
|---|---|---|
| Captura (mic, tela/janela com loopback, aba no Chrome, importação) | Implementado | Áudio de janela isolada no Windows não é possível (P-030); Firefox sem áudio de aba (D-052) |
| Provedores BYOK (Gemini, OpenAI, Claude, Grok, compatível, personalizado) | Implementado | Arquitetura de adaptadores + catálogo: novo provedor = novo adaptador |
| Configuração rápida (colar a chave) | Implementado | Detecta provedor pelo formato da chave |
| Transcrição | Implementado | Fila concorrente, retry, retomada, importação rápida paralela |
| Diarização | Implementado (via provedor) | Gemini estima falantes/timestamps; renomear e reatribuir fala existem |
| Análise | Implementado | Evidência obrigatória, explícito × inferido, responsável inventado é removido |
| Relatório editável + PDF/DOCX/Markdown | Implementado | PDF troca caracteres fora do WinAnsi por “?” (P-032) |
| Segurança de chaves | **Desigual** | Desktop: `safeStorage` (DPAPI) ✔ · Web: **localStorage em texto puro** ✘ · Extensão: `chrome.storage.local` em texto puro ✘ |
| Métricas de participação | **Inexistente** | — |
| Marcadores durante a reunião | **Inexistente** | — |
| IA local (Ollama / Whisper local) | **Inexistente** | Só possível manualmente via “compatível/personalizado” |
| Medição de tempo por etapa | **Inexistente** | Há progresso, não há cronometragem por etapa |
| Exportação TXT/CSV, escolha de seções | **Parcial** | Só “incluir transcrição” sim/não |
| Onboarding / Ajuda | **Parcial** | Termo de uso + configuração rápida; sem apresentação guiada |
| Relatório adaptado ao contexto (audiência × reunião) | **Inexistente** | Estrutura única de 7 seções |

## 4. O que o call.md ensina (e o que não serve)

**Aproveitar (como conceito, implementação própria):**
- Métricas calculadas **localmente** a partir dos segmentos: proporção de fala, palavras/min, perguntas (`?`), monólogo (> 45 s contínuos), duração média de intervenção.
- “Nudges” com **cooldown** (limite de frequência) — modelo para avisos discretos.
- Marcadores (bookmarks) com timestamp.
- Resumo pós-reunião em **extrações paralelas** (visão geral, pontos por tópico, tarefas).

**Não adotar:**
- Dependência do VideoDB (serviço externo pago com créditos) para captura e transcrição — contraria o modelo de gratuidade.
- “Eu × eles” por canal (mic × sistema) no lugar de diarização — o Ouve já faz melhor (N participantes).
- Coaching de vendas, Google Calendar, webhooks, MCP automático — fora do foco e/ou exigem chamadas constantes de IA.
- Foco em macOS — o Ouve prioriza Windows.

## 5. IA local — avaliação

| Opção | Uso | Prós | Contras | Veredito |
|---|---|---|---|---|
| **Ollama** | Análise/relatório | API compatível com OpenAI em `localhost:11434/v1`; o Ouve já tem adaptador compatível | Modelos de 4–8 GB de RAM; web/extensão exigem `OLLAMA_ORIGINS` (CORS) | **Adotar já** como predefinição com detecção automática |
| **whisper.cpp server** (MIT) | Transcrição | Endpoint `/v1/audio/transcriptions` compatível; roda em CPU | Usuário precisa instalar/rodar; sem diarização | **Adotar** como predefinição detectável (desktop) |
| **Transformers.js + Whisper** (Apache-2.0) | Transcrição no próprio app | Zero instalação; funciona em web, desktop e extensão (WebGPU ou WASM) | Download do modelo (≈40 MB–1,5 GB); lento em PCs modestos; sem diarização | **Avaliar** como “modo privado” para arquivos curtos |
| faster-whisper / LocalAI | Transcrição | Rápidos | Python/Docker — difícil para leigo | Não priorizar |
| Diarização local (pyannote etc.) | Falantes | Precisão | Python + GPU; pesado | Não agora — diarização local fica para depois |

Recomendação de hardware a exibir: detectar RAM/núcleos (desktop) e sugerir *tiny/base* em PCs com < 8 GB.

## 6. Problemas encontrados (prioridade)
1. **Chaves em texto puro na web e na extensão** — contraria o requisito 9. Proposta: web guarda a chave só na sessão por padrão (opção “lembrar neste navegador” com aviso explícito); extensão idem, ou criptografia com senha local.
2. **`main` desatualizada** — confunde qualquer auditoria e quem baixa o código.
3. **Sem medição de etapas** — impossível dizer onde está a demora do Gemini. Proposta: cronômetro por etapa (preparação, conversão, envio, transcrição, análise, exportação) mostrado na tela e no log local.
4. **Relatório genérico** — falta modo “Audiência” (falas por pessoa com início–fim, perguntas e respostas por participante) versus “Reunião” (decisões, tarefas).
5. **PDF sem acentos fora do WinAnsi** (P-032) e licença do ffmpeg-static (P-029) pendentes.

## 7. Plano de evolução proposto (em lotes)

| Lote | Conteúdo | Custo de IA | Esforço |
|---|---|---|---|
| **A — Base e confiança** | Avançar `main`; chaves seguras na web/extensão; cronometragem por etapa com indicador de progresso | Nenhum | Baixo |
| **B — Métricas locais** | Tempo de fala, %, intervenções, palavras/min, perguntas, alternâncias, monólogos, silêncio; gráficos simples; linha do tempo “quem falou de que minuto a que minuto” (essencial em audiências); nota de limitações | Nenhum | Médio |
| **C — Marcadores** | Botões/atalhos durante a captura (Decisão, Pergunta pendente, Relevante, Divergência, Encaminhamento, Revisar) ligados ao timestamp; clicar leva ao trecho | Nenhum | Baixo |
| **D — Relatório 2.0** | Estrutura ampliada (perguntas sem resposta, divergências, pontos a esclarecer, momentos importantes, conclusão); modelos por contexto (Audiência, Reunião, Entrevista, Aula); marcadores e métricas no relatório; seleção de seções na exportação; TXT e CSV | Uma chamada de análise (já existente) | Médio |
| **E — IA local** | Predefinições Ollama e whisper.cpp com detecção automática, teste e guia passo a passo; recomendação por hardware; avaliar Whisper no próprio app | Nenhum (local) | Médio/Alto |
| **F — Onboarding e Ajuda** | Apresentação guiada em 4–5 passos, opcional; tela de Ajuda; quadro de transparência (gratuito do Ouve × local × cota gratuita × pago × sua chave) | Nenhum | Baixo |
| **G — Copiloto leve (opcional)** | Avisos locais com cooldown: pergunta sem resposta, monólogo longo, marcador sugerido por palavras-chave (“fica decidido”, “prazo”) | Nenhum (regras locais) | Médio |

Ordem sugerida: A → B → C → D → F → E → G.

## 8. Execução — 22/11/2026
Todos os lotes (A–G) foram implementados na `desenvolvimento/mvp`. Decisões D-072 a D-081 em docs/05. Verificação: lint, formatação, typecheck, 115 testes unitários, builds desktop/extensão/web e 11 E2E (7 desktop Electron, 2 extensão, 2 web) passando. **Não validado:** IA local real (Ollama/whisper.cpp), chaves reais, Windows real.
