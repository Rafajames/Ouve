# 06 — Estado atual do projeto

**Atualizado em:** 21/11/2026
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
- Chaves na extensão ficam no perfil do navegador (D-049).
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
- **20/11/2026:** scaffold do monorepo, núcleo inicial (máquina de estados, contratos, `selectAudioTracks`, registro de provedores), Electron/React com captura desabilitada, base da extensão e CI aprovada (commits a4b628c, cbe8a15).
- **21/11/2026 (noite):** tela da sessão em tela única — sem rolagem da página; só a transcrição rola (validado por E2E em 1366×768 e 1280×720).
- **21/11/2026 (tarde, 5):** importação rápida automática (D-068) com MP3, pedaços longos, paralelismo adaptativo e exibição do tempo total; chaves Google "AQ." reconhecidas. 89 testes unitários e 9 E2E passando.
- **21/11/2026 (tarde, 4):** configuração rápida só com a chave (D-065), Gemini com modelo dedicado de transcrição e plano B (D-066), espera automática em limite de uso (D-067), aviso do plano gratuito. 85 testes unitários e 9 E2E passando. Nada validado com chave real.
- **21/11/2026 (tarde, 3):** instalador Windows gerado pelo GitHub Actions e publicado em Releases (`teste-windows`); empacotamento validado em Linux com ffmpeg embutido.
- **21/11/2026 (tarde, 2):** termo de uso pedido só no primeiro uso (D-063), removida a confirmação a cada captura/importação no desktop, na extensão e no popup. E2E atualizados (7 desktop + 2 extensão).
- **21/11/2026 (tarde):** melhorias de interface — ícones SVG, tema claro/escuro/sistema, tela de sessão em duas colunas com resumo e próximos passos, estados vazios, extensão com o mesmo sistema visual (pacote `@ouve/ui`). 8 testes E2E desktop passando, incluindo alternância de tema.
- **21/11/2026:** implementação das etapas 1–9 do prompt mestre na branch `desenvolvimento/mvp` (detalhes acima e em docs/05).
