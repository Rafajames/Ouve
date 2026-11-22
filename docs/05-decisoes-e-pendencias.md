# 05 — Decisões e pendências

Este registro preserva as decisões anteriores e registra suas atualizações. Estados: aceita, provisória, pendente, substituída ou cancelada.

## Decisões estabelecidas anteriormente
| ID | Decisão | Estado |
|---|---|---|
| D-001 | Nome do produto: Ouve | Aceita |
| D-002 | Produto inclui extensão de navegador | Aceita |
| D-003 | Compatibilidade-alvo da extensão: Chrome e Firefox | Aceita |
| D-004 | Sem conta obrigatória no MVP | Aceita |
| D-005 | Sem histórico ou armazenamento permanente no MVP | Aceita |
| D-006 | Processamento temporário; usuário controla exportação local | Aceita |
| D-007 | Análise de arquivos gravados | Aceita |
| D-008 | Português brasileiro como prioridade | Aceita |
| D-009 | Transcrição, falantes quando suportados, tópicos, resumo e relatório | Aceita |
| D-010 | Exportação PDF e DOCX | Aceita |
| D-011 | Acompanhamento ao vivo | Aceita |
| D-012 | BYOK e provedores intercambiáveis | Aceita |
| D-013 | TypeScript, React e WebExtensions como diretrizes | Aceita |
| D-014 | Aplicativo desktop e extensão Chrome/Firefox | Aceita |
| D-015 | Windows como primeira plataforma desktop | Aceita |
| D-016 | Usuário seleciona tela, janela ou aba como fonte | Aceita, com escopo atualizado por D-029 |
| D-017 | Fonte pode estar em outro monitor ou aplicativo | Aceita, condicionada à disponibilidade de áudio |
| D-018 | Compartilhamento é privado com o Ouve | Aceita |
| D-019 | Extensão pode operar na aba da audiência | Aceita, conforme compatibilidade |
| D-020 | Núcleo compartilhado entre desktop e extensão | Aceita |
| D-021 | Modos de arquivo, captura externa e aba | Aceita |
| D-022 | Captura privada, sem transmissão a terceiros | Aceita |
| D-023 | Não exigir reprodução interna do conteúdo externo | Aceita |
| D-024 | MCP é ferramenta opcional de desenvolvimento | Aceita |
| D-025 | Sem servidor MCP público no MVP | Aceita |
| D-026 | Núcleo compartilhado e adaptadores de plataforma | Aceita |
| D-027 | TypeScript/React; workspace a definir no bootstrap | Substituída por D-031 |
| D-028 | Electron candidato recomendado | Substituída por D-030 |

## Novas decisões — 20/11/2026
| ID | Decisão | Estado |
|---|---|---|
| D-029 | O Ouve processará exclusivamente áudio. Não haverá análise visual, OCR, gravação de tela ou armazenamento de quadros. A seleção de tela/janela/aba será usada para escolher a fonte de captura de áudio; se a API exigir uma trilha visual para iniciar o compartilhamento, os quadros serão descartados imediatamente e nunca processados ou persistidos. | Aceita |
| D-030 | Electron será o framework desktop inicial, com Windows como alvo prioritário. A escolha permite iniciar o scaffold; riscos e compatibilidade de captura permanecem sujeitos a validação técnica. | Aceita para implementação inicial |
| D-031 | Monorepo com pnpm workspaces, TypeScript estrito e núcleo compartilhado. | Aceita |
| D-032 | A captura ao vivo terá áudio da fonte selecionada e microfone opcional, com controles independentes quando a plataforma permitir. | Aceita |
| D-033 | Transcrição ao vivo e pós-processamento/revisão serão experiências complementares. | Aceita |
| D-034 | Diarização automática será usada quando disponível; nomes serão editáveis e nunca inferidos sem evidência. | Aceita |
| D-035 | Arquitetura de IA aceitará provedores oficiais, endpoints compatíveis com API OpenAI e provedores personalizados com URL/base URL, modelo e autenticação configuráveis. | Aceita |
| D-036 | Adaptadores separados para transcrição, diarização e análise textual; o usuário poderá combinar fornecedores diferentes. | Aceita |
| D-037 | Provedores de referência para integração: OpenAI, Google Gemini, Anthropic Claude e xAI Grok, além de outros serviços conhecidos e endpoints personalizados. Disponibilidade de cada capacidade depende da API contratada. | Aceita |
| D-038 | Chaves BYOK serão armazenadas localmente com proteção do sistema operacional quando disponível; nunca em código, logs ou repositório. | Aceita |
| D-039 | Sem backend próprio, login, analytics de conteúdo, sincronização ou histórico permanente no MVP. | Aceita |
| D-040 | Arquivos de áudio e vídeo serão aceitos; em vídeo, somente a faixa de áudio será extraída. Formatos e limites finais dependem da implementação e validação. | Aceita |
| D-041 | Transcrição em português brasileiro é prioridade; outros idiomas e detecção automática serão suportados conforme provedor. | Aceita |
| D-042 | Relatórios editáveis incluirão resumo, tópicos, perguntas/respostas, decisões, tarefas, responsáveis e prazos quando explicitamente presentes no conteúdo. | Aceita |
| D-043 | PDF e DOCX são formatos iniciais de exportação local. | Aceita |
| D-044 | Limites iniciais de referência: arquivo até 2 GB e sessão até 4 horas, sujeitos a limites técnicos e do provedor; não anunciar como garantidos antes de validar. | Provisória |
| D-045 | O desenvolvimento seguirá mesmo sem testes manuais imediatos; funcionalidades dependentes de plataforma serão implementadas por adaptadores e marcadas como não validadas até haver evidência. | Aceita |

## Pendências técnicas — não bloqueiam scaffold
| ID | Questão | Tratamento |
|---|---|---|
| P-020 | Captura de áudio de tela/janela/aba em Windows | Implementar interface/adaptador e validar posteriormente |
| P-021 | Diferenças de captura entre Chrome e Firefox | Adaptadores e testes quando ambiente disponível |
| P-022 | Áudio de aplicativos externos, incluindo VLC | Validar posteriormente; não prometer compatibilidade universal |
| P-023 | APIs de seleção podem exigir trilha visual | Descartar quadros imediatamente; comprovar comportamento em teste |
| P-024 | Escolha dos primeiros provedores e modelos | Implementar catálogo extensível; selecionar integrações por capacidade e evidência |
| P-025 | Formatos, codecs, duração e tamanho efetivos | Implementar validação configurável; fechar limites após testes |
| P-026 | Proteção de chaves em cada plataforma | Implementar abstração de armazenamento seguro |
| P-027 | Qualidade de diarização e português brasileiro | Comparação posterior com conjunto de amostras autorizado |
| P-028 | Política de privacidade, termos e revisão jurídica | Necessária antes de distribuição pública |

## Decisões substituídas/canceladas
- D-027 foi substituída por D-031.
- D-028 foi substituída por D-030.
- P-025 antigo sobre análise visual e P-017/P-019 relativos a sincronização/amostragem visual deixam de fazer parte do escopo; não haverá pipeline visual. O número P-025 atual refere-se a formatos e limites.

## Regras de atualização
Toda nova decisão deve registrar contexto, opções, decisão, justificativa, impactos, data e estado. Não apagar decisões substituídas; marcar seu estado e apontar a sucessora.


## Novas decisões — 21/11/2026 (implementação do MVP)
| ID | Decisão | Contexto / justificativa | Estado |
|---|---|---|---|
| D-046 | Pacotes do monorepo: `shared`, `core`, `capture`, `providers`, `transcription`, `analysis`, `reports`. | Segue a estrutura conceitual do prompt mestre; `shared` concentra erros, retry/timeout, logger com redação e sanitização, sem dependência de domínio. | Aceita |
| D-047 | Chamadas de IA no desktop são feitas pelo processo principal do Electron; o renderer nunca recebe chaves. | Reduz exposição de segredos (CSP do renderer bloqueia rede externa). | Aceita |
| D-048 | Chaves no desktop cifradas com Electron `safeStorage` (DPAPI no Windows). Sem criptografia disponível, ficam apenas em memória. | Atende D-038 sem gravar texto puro em disco. | Aceita |
| D-049 | Na extensão, chaves ficam em `chrome.storage.local` (perfil do navegador, sem criptografia do SO), com aviso explícito na interface. | Não há cofre do SO acessível a WebExtensions. | Aceita, com limitação |
| D-050 | Captura no desktop: seletor próprio do Ouve lista telas/janelas **sem miniaturas**; `setDisplayMediaRequestHandler` entrega a fonte com `audio: "loopback"` no Windows; a trilha de vídeo exigida pela API é interrompida imediatamente (`selectAudioTracks`). | Cumpre D-029. Limitação: o loopback do Electron é o áudio do **sistema inteiro**, não isolado por janela. | Aceita; validação real pendente (P-020) |
| D-051 | Captura de aba no Chrome via `chrome.tabCapture.getMediaStreamId` + `getUserMedia` somente áudio (sem trilha de vídeo), com reprodução local para não silenciar a aba. | API documentada do Chrome ≥116. | Aceita; validação real pendente (P-021) |
| D-052 | Firefox: sem captura de áudio de aba/tela (sem API equivalente); oferece microfone e importação. | Limitação da plataforma, exibida na interface. | Aceita |
| D-053 | Áudio processado como WAV PCM 16 kHz mono em blocos (ao vivo: 20 s, configurável; importação: 120 s). Blocos silenciosos não são enviados. | Formato aceito por todos os provedores de transcrição implementados; reduz custo. | Aceita |
| D-054 | Importação no desktop usa ffmpeg (`-vn`, somente faixa de áudio) gerando segmentos temporários apagados ao fim; nada é carregado inteiro na memória. Na extensão, decodificação local limitada a 300 MB / 2 h. | Atende §7 do prompt mestre. | Aceita |
| D-055 | Transcrição idempotente por índice de bloco; falhas ficam retidas em memória para nova tentativa sem duplicar segmentos. | Requisito de recuperação de falhas. | Aceita |
| D-056 | Diarização usa rótulos neutros "Falante N"; nomes só por edição do usuário. Rótulos do provedor são locais a cada bloco — o mapeamento entre blocos é aproximado. | D-034; limitação documentada. | Aceita |
| D-057 | Análise valida a saída do modelo contra a transcrição: evidências inexistentes são descartadas, item "explícito" sem evidência vira "inferência", responsável/prazo que não aparece nos trechos citados é removido com aviso. | Requisito de não inventar responsáveis, decisões ou prazos (D-042). | Aceita |
| D-058 | Exportação local com `pdf-lib` (PDF, fontes padrão WinAnsi — caracteres fora do conjunto viram "?") e `docx` (DOCX); Markdown como extra. Ambas MIT. | Sem serviço externo; licenças permissivas. | Aceita |
| D-059 | Modelos sugeridos no catálogo são apenas sugestões editáveis (referência jun/2026); o teste de conexão lista os modelos disponíveis para a chave do usuário. | Modelos mudam com frequência. | Aceita |
| D-060 | Testes E2E usam um servidor local que imita a API compatível com OpenAI; nenhum teste usa chave real. | Requisito de não usar chaves fictícias como reais. | Aceita |

## Novas pendências — 21/11/2026
| ID | Questão | Tratamento |
|---|---|---|
| P-029 | O binário do pacote `ffmpeg-static` é distribuído sob GPL. Distribuir o instalador com ele exige conformidade com a GPL ou substituição por build LGPL/ffmpeg do sistema. | **Revisão de licenciamento obrigatória antes de distribuição pública.** O app já aceita `OUVE_FFMPEG_PATH`. |
| P-030 | Áudio isolado por janela/processo no Windows (WASAPI process loopback) exige módulo nativo. | Hoje o áudio é do sistema inteiro; avaliar addon nativo. |
| P-031 | `ScriptProcessorNode` é obsoleto; migrar para `AudioWorklet` respeitando a CSP da extensão. | Backlog técnico. |
| P-032 | Fontes do PDF não cobrem caracteres fora do WinAnsi (ex.: emojis, alguns símbolos). | Avaliar fonte TTF embutida com licença compatível. |
| P-033 | Instalador NSIS e assinatura de código não foram gerados nem testados (exigem Windows). | Validar em Windows; avaliar certificado. |
| P-034 | ID do Firefox (`@example.invalid`) é provisório. | Definir antes de publicar na AMO. |
| P-035 | Fichas de política de dados por provedor (docs/09 §6) ainda não verificadas em fonte oficial atual. | Preencher `docs/providers/` com data de verificação. |

## Divergências registradas — 21/11/2026
- docs/08 ainda descrevia pipeline visual (VideoFramePort, VisualObservation, AnalyzeVisualContext, amostragem de quadros). Essas partes estão **substituídas por D-029**; o documento recebeu uma nota no topo, sem apagar o texto histórico.
- O scaffold carregava o preload como `index.js`, mas o build gerava `index.mjs`; e preload com `sandbox: true` precisa ser CommonJS. Corrigido (preload gerado como `index.cjs`).
- Pacotes do workspace eram externalizados no build do processo principal (seriam carregados como TypeScript cru em tempo de execução). Corrigido no `electron.vite.config.ts`.

## Novas decisões — 21/11/2026 (interface)
| ID | Decisão | Contexto / justificativa | Estado |
|---|---|---|---|
| D-061 | Pacote `@ouve/ui` com ícones SVG próprios e tokens de design (cores, raios, sombras) compartilhados por desktop e extensão. | Visual consistente sem dependência externa de ícones. | Aceita |
| D-062 | Temas claro, escuro e "seguir o sistema" (padrão). No desktop a preferência fica em `settings.json`; a extensão segue o tema do navegador. | Pedido de melhoria visual; acessibilidade em ambientes claros. | Aceita |
| D-063 | O termo de uso/autorização é aceito **uma única vez**, no primeiro uso após a instalação (desktop e extensão). As telas de captura e importação não pedem confirmação a cada sessão; mantêm apenas o aviso de para qual provedor o áudio vai. Aumentar `TERMS_VERSION` volta a pedir o aceite. | Decisão do usuário (21/11/2026): uso interno; quem grava a reunião é a própria pessoa, que informa os participantes, e nas audiências quem grava é o assessor, já autorizado. Substitui a confirmação por sessão; indicador persistente, pausa e encerramento continuam obrigatórios. | Aceita |
| D-064 | Instalador Windows (NSIS, sem assinatura) gerado no GitHub Actions (`windows-latest`) e publicado como pré-release `teste-windows`. O ffmpeg vai como recurso externo do instalador; o app empacotado não leva código-fonte dos pacotes (tudo é empacotado pelo electron-vite). | Pedido do usuário: instalar e abrir sem ambiente de desenvolvimento. Empacotamento validado em Linux (app abre e importa com o ffmpeg embutido, sem ffmpeg no PATH). | Aceita; P-033 (assinatura) e P-029 (licença do ffmpeg) seguem abertas |
| D-065 | Configuração rápida: o usuário só cola a chave; o Ouve reconhece o provedor pelo prefixo (sk-ant-, xai-, AIza, sk-), testa a conexão, escolhe os modelos mais novos disponíveis para a chave e já seleciona o provedor para transcrição e análise. Claude/Grok configuram só análise, com aviso. A tela anterior virou "Configuração avançada". | Pedido do usuário: não configurar provedor manualmente. | Aceita |
| D-066 | Gemini como opção recomendada (tem plano gratuito). Transcrição pelo modelo dedicado `gemini-3.5-transcribe` (tempo por palavra e falantes); se recusar o envio inline (não documentado), o Ouve usa o modelo de análise. Aviso explícito: no plano gratuito o Google pode usar o conteúdo para melhorar produtos. | Custo zero amplia o uso; termos do Gemini sobre serviços gratuitos. | Aceita; validação com chave real pendente |
| D-067 | Em limite de uso (HTTP 429), as novas tentativas esperam pelo menos 10 s, crescendo até 60 s, e respeitam o Retry-After do provedor. | Planos gratuitos têm limites baixos por minuto. | Aceita |
| D-068 | Importação rápida automática: o arquivo nunca é reproduzido; o áudio é extraído direto e enviado em pedaços paralelos escolhidos pela IA configurada — Gemini Transcribe e OpenAI com tempo por trecho: 10 min em MP3 32 kbps (3–4 em paralelo); OpenAI sem tempo por trecho: 2 min em MP3; genérico: 2 min em WAV. O paralelismo diminui sozinho em limite de uso. Os tempos de cada pedaço vêm da lista do ffmpeg. Extensão: WAV de até 5 min. A análise continua opcional. | Pedido do usuário: transcrever 1 h de gravação em poucos minutos. Medição: extração de 1 h de vídeo (116 MB) em ~20 s numa máquina de 2 núcleos. Tempo total depende da IA; não medido com chave real. | Aceita |
| D-069 | Versão web (`apps/web`) publicada no GitHub Pages: reaproveita as telas do desktop com uma "ponte web" que implementa a mesma interface no navegador. Sem servidor do Ouve: chamadas de IA saem do navegador direto ao provedor (CORS). Captura pelo seletor do navegador (aba ou tela inteira com áudio; janela avulsa não traz áudio). Importação decodificada no navegador (até 300 MB / 2 h). Preferências e chaves no localStorage do navegador. Desktop e extensão continuam. | Pedido do usuário: abrir pelo link sem baixar novas versões. | Aceita |
| D-070 | Atualização do desktop manual: botão "Verificar atualizações" (Configurações e menu lateral) compara o commit do build com a pré-release `teste-windows`; "Baixar e instalar" só por clique, baixa com progresso, abre o instalador e fecha o app. Nada é verificado ou instalado automaticamente. | Pedido do usuário: ver atualizações, sem atualização automática. | Aceita |
| D-071 | Autoria exibida em todas as versões: "Idealizado e desenvolvido por Rafajames" no termo de primeiro uso, menu lateral, Configurações → Sobre, extensão, popup, rodapé e metadados dos relatórios PDF/DOCX, copyright do instalador, manifestos e `AUTORIA.md` (todos os direitos reservados). | Pedido do autor para comprovar a autoria. Recomenda-se avaliar registro no INPI e conferir o contrato de trabalho quanto à titularidade (P-036). | Aceita |
| P-036 | Titularidade do software (Lei 9.609/98, art. 4º) frente ao vínculo com a Sonda/TJRR e eventual registro de programa de computador no INPI. | Verificar contrato e orientação jurídica antes de distribuir institucionalmente. | Pendente |

## Novas decisões — 22/11/2026 (auditoria e evolução — docs/17)
| ID | Decisão | Motivo | Status |
|---|---|---|---|
| D-072 | Divergência `main` × versão testada esclarecida: a implementação funcional está em `desenvolvimento/mvp` (origem do instalador e da web); `main` é ancestral sem commits próprios. | Auditoria de 22/11 (docs/17). | Registrada |
| D-073 | Métricas de participação calculadas localmente a partir dos segmentos (tempo de fala, %, intervenções, palavras/min, perguntas por “?”, alternâncias, falas contínuas > 2 min, silêncios > 10 s, linha do tempo de quem falou de que minuto a que minuto). Sem chamadas de IA e sem julgamentos; limitações exibidas na tela e no relatório. | Prompt mestre §6.4; requisito de audiências (tempo de cada fala). Conceito inspirado no call.md (MIT), implementação própria. | Aceita |
| D-074 | Marcadores locais (Decisão, Pergunta pendente, Informação relevante, Divergência, Encaminhamento, Ponto para revisar) com tempo decorrido da sessão, atalhos Alt+1…6, edição, remoção e salto ao trecho; entram no relatório e no CSV. | Prompt mestre §6.5. | Aceita |
| D-075 | Avisos discretos durante a captura por regras locais (palavras como “fica decidido”, “prazo”; pergunta sem resposta de outro participante após 20 s; fala contínua > 3 min), no máximo um a cada 90 s, opcionais (Configurações). Aceitar o aviso cria um marcador “sugerido”. Nenhuma chamada extra de IA. | Prompt mestre §6.7: copiloto leve sem custo de cota. | Aceita |
| D-076 | Relatório 2.0: análise ganha objetivo, conclusão, divergências, pontos a esclarecer e momentos importantes; perguntas sem resposta derivadas localmente; tipo de sessão (Geral, Reunião, Audiência, Entrevista, Aula) muda a orientação ao modelo e a ordem/títulos das seções. A análise usa só o texto (o áudio não é reenviado). | Prompt mestre §6.6. | Aceita |
| D-077 | Exportação com escolha de seções e do que incluir (transcrição, horários, participação, marcadores, evidências, observações) e novos formatos TXT e CSV (BOM, separador “;”, proteção contra fórmulas). | Prompt mestre §8. | Aceita |
| D-078 | Chaves na web e na extensão ficam **só na sessão por padrão** (sessionStorage / chrome.storage.session); “Lembrar neste navegador” é escolha explícita com aviso de que não há criptografia do SO. Quem já tinha chave salva continua com “lembrar” ligado. Substitui a parte de chaves da D-069 e a limitação D-049. | Prompt mestre §9: não guardar chaves em texto puro no localStorage. | Aceita |
| D-079 | Cronometragem por etapa (conversão, transcrição com envio, análise, exportação) exibida na sessão (“Tempo por etapa”), sem guardar conteúdo. Envio e transcrição medidos juntos (a API faz os dois na mesma chamada). | Prompt mestre §7: medir antes de otimizar. | Aceita |
| D-080 | IA local: detecção automática de Ollama (análise) e servidores Whisper compatíveis com OpenAI (whisper.cpp e outros, transcrição), guia de instalação, modelos sugeridos por memória do computador, configuração com um clique e download de modelo do Ollama por ação do usuário (desktop). Usa o adaptador “compatível” existente. Whisper dentro do próprio app (Transformers.js) fica em avaliação. | Prompt mestre §4.3. | Aceita; não validado com os programas reais |
| D-081 | Apresentação inicial opcional (5 passos, pode pular, reabre em Configurações) e tela de Ajuda com passo a passo, quadro do que é gratuito × para onde vão os dados, onde conseguir chave em cada provedor e glossário. | Prompt mestre §4.2, §4.4 e §5. | Aceita |
| P-037 | Validar com Ollama e whisper.cpp reais no Windows (endereços, flags do servidor, desempenho por hardware). | — | Pendente |
| P-038 | Atualizar a `main` (fast-forward a partir de `desenvolvimento/mvp`) após revisão do James. | — | Pendente |
