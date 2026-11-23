# 06 — Estado atual do projeto

**Atualizado em:** 23/11/2026
**Repositório:** https://github.com/Rafajames/Ouve
**Branch de desenvolvimento:** `desenvolvimento/mvp` (main preservada até revisão)

## Estado geral
O Ouve passou de scaffold para um MVP funcional em código: aplicativo desktop Electron com captura de áudio por adaptadores, importação de arquivos, transcrição por provedores BYOK, análise validada, relatório editável e exportação PDF/DOCX; extensões Chrome/Firefox com captura de aba (Chrome), microfone e importação. **Nada que dependa de hardware, gesto real do usuário ou chave real de provedor foi validado** — ver “Depende de validação real”.

## Implementado e testado automaticamente
| Área | O que existe | Evidência |
|---|---|---|
| Fundação | Monorepo pnpm com 7 pacotes + 2 apps, TypeScript strict, ESLint, Prettier, CI com E2E | `pnpm lint`, `format:check`, `typecheck`, `test`, builds |
| Domínio | Contratos de serviços separados, `TranscriptStore` idempotente, falantes neutros e editáveis, limites de mídia | testes `core` |
| Captura | Seleção ≠ obtenção de áudio; trilhas de vídeo interrompidas; mixagem fonte+microfone; 16 kHz; pausa/retomada/encerramento; detecção de silêncio e de fonte encerrada | testes `capture` (dublês de Web Audio) |
| Provedores | OpenAI, compatível, Gemini, Claude, Grok, personalizado; timeout, retry, cancelamento, teste de conexão | testes `providers` (fetch simulado) + E2E com servidor local |
| Transcrição | Fila concorrente idempotente, retry, retomada de falhas, contexto anterior, pula silêncio | testes `transcription` + E2E |
| Análise | Prompt com transcrição como dado não confiável; validação por evidência; explícito × inferido | testes `analysis` + E2E (responsável inventado removido) |
| Relatórios | PDF, DOCX, Markdown locais; nome de arquivo seguro | testes `reports` + inspeção visual do PDF + E2E |
| Desktop | IPC validado, CSP, permissões só de mídia, safeStorage, ffmpeg, 7 telas principais | 8 testes do main (ffmpeg real) + 5 E2E Electron |
| Extensão | Popup tabCapture com consentimento, página React, permissões mínimas, builds Chrome/Firefox | 5 testes unitários + 2 E2E no Chromium |

Total: 76 testes unitários e 9 testes E2E (7 desktop + 2 extensão) passando localmente em 21/11/2026.

## Depende de validação real (não comprovado)
- Captura de tela/janela no Windows com áudio por loopback (e o fato de ser áudio do sistema inteiro).
- Captura de aba no Chrome (`tabCapture`), microfone em Chrome/Firefox e no desktop.
- Qualquer provedor com chave real: formatos de resposta, qualidade em pt-BR, diarização, custos, limites.
- Arquivos reais de 2 GB / 4 h, M4A/MOV/MKV variados, consumo de memória em sessões longas.
- Instalador Windows (NSIS), assinatura e publicação nas lojas de extensões.

## Limitações conhecidas
- Áudio de janela específica no Windows não é isolado (P-030).
- Firefox não captura áudio de aba/tela (D-052).
- Na web e na extensão, chaves ficam só na sessão por padrão; se o usuário escolher “lembrar”, ficam no perfil do navegador sem criptografia do SO (D-078).
- Métricas dependem da qualidade dos horários e da diarização do provedor; perguntas contadas por “?” (D-073).
- Servidores Whisper locais não separam vozes (D-080).
- Gemini estima timestamps/falantes; OpenAI `gpt-4o-transcribe` não retorna timestamps internos ao bloco.
- Transcrição ao vivo por blocos (latência ≈ duração do bloco + resposta do provedor), não streaming.
- PDF substitui caracteres fora do WinAnsi por “?” (P-032).
- ffmpeg-static (GPL) exige revisão de licença antes de distribuir (P-029).
- Não há revisão jurídica/LGPD; os mecanismos de consentimento não equivalem a conformidade (P-028).

## Próximas etapas
1. Rodar o app no Windows e validar captura (tela, janela, microfone) e importação com arquivos reais.
2. Validar provedores com chaves reais e amostras autorizadas; ajustar adaptadores.
3. Validar extensão Chrome (aba) e Firefox (microfone/importação).
4. Resolver P-029 (ffmpeg) e gerar instalador.
5. Itens do backlog técnico (AudioWorklet, fonte TTF, streaming, bundle).

## Histórico
- **23/11/2026:** redesign completo da interface (docs/18, D-083–D-086): menu lateral compacto e recolhível, cabeçalho único com indicador global de gravação/processamento, páginas em tela única (rolagem só interna), nova página **Relatórios** (tabela com pesquisa, período, ordenação, paginação, abrir/editar/exportar/excluir; relatórios só na memória até fechar o app), relatório com navegação por seções, Provedores com tabela e painel lateral de configuração, Configurações e Ajuda por categorias, nova identidade visual (verde-azulado, tema claro/escuro/sistema). Termo de uso v2. Testes: 126 unitários e 10 E2E desktop passando nesta sessão, incluindo o novo teste de layout em 1280×720, 1366×768, 1440×900 e 1920×1080 nos temas claro e escuro; a versão web foi conferida no Chromium do Electron nas mesmas páginas (o E2E web e o da extensão rodam no CI, pois o Chromium do Playwright não pôde ser baixado neste ambiente). Não validado em Windows real (P-040).
- **22/11/2026 (2):** IA local com um clique no desktop (D-082): whisper.cpp embutido no instalador com modelos baixados pela interface e ligados automaticamente ao transcrever; “Instalar Ollama” baixa e abre o instalador oficial. Whisper dentro do app registrado como melhoria futura (docs/15). Não validado em Windows real (P-039).
- **22/11/2026:** auditoria completa (docs/17) e evolução — métricas locais, marcadores, avisos discretos, cronometragem por etapa, relatório 2.0 por tipo de sessão, exportação TXT/CSV com escolha de seções, chaves só na sessão na web/extensão, IA local (Ollama/whisper.cpp), apresentação inicial e Ajuda (D-072–D-081). 115 testes unitários e 11 E2E (7 desktop, 2 extensão, 2 web) passando nesta sessão. Nada validado com IA local real nem com chave real.
- **20/11/2026:** scaffold do monorepo, núcleo inicial (máquina de estados, contratos, `selectAudioTracks`, registro de provedores), Electron/React com captura desabilitada, base da extensão e CI aprovada (commits a4b628c, cbe8a15).
- **21/11/2026 (noite, 2):** versão web no GitHub Pages (D-069) e atualização manual do desktop (D-070). 96 testes unitários e 11 E2E (7 desktop, 2 extensão, 2 web) passando.
- **21/11/2026 (noite):** tela da sessão em tela única — sem rolagem da página; só a transcrição rola (validado por E2E em 1366×768 e 1280×720).
- **21/11/2026 (tarde, 5):** importação rápida automática (D-068) com MP3, pedaços longos, paralelismo adaptativo e exibição do tempo total; chaves Google "AQ." reconhecidas. 89 testes unitários e 9 E2E passando.
- **21/11/2026 (tarde, 4):** configuração rápida só com a chave (D-065), Gemini com modelo dedicado de transcrição e plano B (D-066), espera automática em limite de uso (D-067), aviso do plano gratuito. 85 testes unitários e 9 E2E passando. Nada validado com chave real.
- **21/11/2026 (tarde, 3):** instalador Windows gerado pelo GitHub Actions e publicado em Releases (`teste-windows`); empacotamento validado em Linux com ffmpeg embutido.
- **21/11/2026 (tarde, 2):** termo de uso pedido só no primeiro uso (D-063), removida a confirmação a cada captura/importação no desktop, na extensão e no popup. E2E atualizados (7 desktop + 2 extensão).
- **21/11/2026 (tarde):** melhorias de interface — ícones SVG, tema claro/escuro/sistema, tela de sessão em duas colunas com resumo e próximos passos, estados vazios, extensão com o mesmo sistema visual (pacote `@ouve/ui`). 8 testes E2E desktop passando, incluindo alternância de tema.
- **21/11/2026:** implementação das etapas 1–9 do prompt mestre na branch `desenvolvimento/mvp` (detalhes acima e em docs/05).
