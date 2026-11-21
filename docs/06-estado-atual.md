# 06 — Estado atual do projeto

**Atualizado em:** 20/11/2026  
**Repositório:** https://github.com/Rafajames/Ouve  
**Branch:** main

## Estado geral
A implementação foi iniciada no GitHub. O scaffold do monorepo, núcleo compartilhado, aplicativo Electron/React, base da extensão e CI estão no repositório. O workflow CI do commit a4b628c passou integralmente após as alterações recentes no núcleo: instalação, typecheck, testes, build desktop e build da extensão.

## Decisões consolidadas
- Aplicativo desktop Windows primeiro e extensões Chrome/Firefox.
- Usuário seleciona tela inteira, janela ou aba, em experiência semelhante ao compartilhamento do Meet.
- Processamento exclusivamente de áudio: sem gravação de tela, OCR, visão computacional ou persistência de quadros.
- Se uma API exigir trilha visual para iniciar a seleção, os quadros devem ser descartados imediatamente.
- Áudio da fonte selecionada e microfone opcional.
- Arquivos de áudio e vídeo; em vídeo, extrair somente a faixa de áudio.
- Transcrição ao vivo e posterior, diarização quando disponível.
- Análise com resumo, tópicos, perguntas/respostas, decisões, tarefas, responsáveis e prazos quando sustentados pelo conteúdo.
- Relatórios editáveis e exportação local PDF/DOCX.
- BYOK: OpenAI, Gemini, Claude, Grok, outros provedores e endpoints personalizados.
- TypeScript, React, Electron, pnpm workspaces e núcleo compartilhado.
- Sem conta, backend próprio, analytics de conteúdo, sync ou histórico permanente no MVP.

## Implementado no repositório
- Workspace pnpm e configuração TypeScript estrita.
- Pacote @ouve/core.
- Máquina de estados inicial da sessão com testes.
- Contratos iniciais de captura, áudio, transcrição, diarização e análise.
- Utilitário selectAudioTracks, que mantém somente áudio e interrompe trilhas não áudio, com testes.
- Tipos iniciais de relatório, participantes e artefatos de sessão.
- Registro extensível de provedores com testes.
- Configuração de provedor separa referência da credencial do segredo; apiKey não faz parte do ProviderConfig persistível.
- Scaffold Electron + React, com tela inicial e captura desabilitada.
- Scaffold WebExtension com manifestos base Chrome/Firefox e popup informativo.
- Workflow CI para instalação, typecheck, testes e builds.
- Documentação de decisões, estado, backlog e execução atualizada.

## Verificação automatizada
O CI do commit cbe8a15ef2ec4926aa997e6fdb25f4bf0cb43504 foi aprovado:
- Typecheck: aprovado.
- Testes automatizados: aprovados.
- Build Electron/desktop: aprovado.
- Build WebExtension: aprovado.

A aprovação comprova compilação e testes automatizados do scaffold, não captura real de áudio nem compatibilidade de plataformas. As alterações subsequentes no núcleo aguardam a nova rodada de CI.

## Ainda não implementado ou comprovado
- Captura real de tela/janela/aba e extração de áudio.
- Captura de áudio de sistema/loopback e microfone.
- Comunicação entre desktop e extensão.
- Adaptadores de provedores de transcrição/análise e armazenamento seguro de chaves.
- Importação/extração de áudio de arquivos.
- Diarização real, análise, editor e exportação PDF/DOCX.
- Instalador Windows e pacotes de distribuição das extensões.
- Execução local pelo usuário.

## Próximas etapas
1. Confirmar CI das alterações mais recentes.
2. Expandir modelos e casos de uso do núcleo.
3. Implementar armazenamento seguro local para credenciais BYOK.
4. Implementar captura de áudio desktop atrás de adaptador.
5. Implementar pipeline de arquivos e adaptadores de provedores.
6. Implementar transcrição, análise, editor e exportação.
7. Integrar e empacotar desktop e extensão.

## Validações adiadas
O usuário autorizou prosseguir sem testes manuais imediatos. Captura por fonte/SO/navegador, compatibilidade com VLC/Meet/Zoom/Teams, diarização, limites, custos e qualidade dos provedores permanecem não validados. Não anunciar essas capacidades como comprovadas.
