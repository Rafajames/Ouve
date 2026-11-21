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
