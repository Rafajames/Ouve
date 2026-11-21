# 06 — Estado atual do projeto

**Atualizado em:** 20/11/2026  
**Repositório:** https://github.com/Rafajames/Ouve  
**Branch:** main

## Estado geral
A implementação foi iniciada no GitHub. O repositório agora contém o primeiro scaffold do monorepo, núcleo compartilhado, aplicativo Electron/React, base da extensão e CI. Ainda não há prova de execução local nem validação real da captura.

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
- Configuração raiz do workspace pnpm e TypeScript.
- Pacote @ouve/core com tipos de sessão, estados e contratos iniciais de áudio/IA.
- Máquina de estados de sessão com teste unitário.
- Fronteira selectAudioTracks, que mantém somente trilhas de áudio e interrompe trilhas não áudio, com testes unitários.
- Scaffold Electron + React, com tela inicial informativa e captura desabilitada.
- Scaffold WebExtension com manifestos base Chrome e Firefox e popup informativo.
- Workflow inicial de CI para instalação, typecheck, testes e builds.
- README, AGENTS, decisões, backlog e plano de execução atualizados.

## Ainda não implementado ou comprovado
- Captura real de tela/janela/aba e extração de áudio.
- Captura de áudio de sistema/loopback e microfone.
- Comunicação entre desktop e extensão.
- Adaptadores de provedores de transcrição/análise e armazenamento seguro de chaves.
- Importação/extração de áudio de arquivos.
- Diarização, análise, editor e exportação PDF/DOCX.
- Instalador Windows e pacotes de distribuição das extensões.
- Execução local dos comandos e resultado do CI.

## Próximas etapas
1. Confirmar instalação, typecheck, testes e builds pelo CI.
2. Corrigir problemas do scaffold.
3. Expandir os modelos e casos de uso do núcleo.
4. Implementar captura de áudio desktop atrás de um adaptador.
5. Implementar configuração BYOK e adaptadores de provedores.
6. Implementar pipeline de arquivos, transcrição, análise e exportação.

## Validações adiadas
O usuário autorizou prosseguir sem testes manuais imediatos. Captura por fonte/SO/navegador, compatibilidade com VLC/Meet/Zoom/Teams, diarização, limites, custos e qualidade dos provedores permanecem não validados. Não anunciar essas capacidades como comprovadas.
