# 06 — Estado atual do projeto

**Atualizado em:** 20/11/2026  
**Repositório:** https://github.com/Rafajames/Ouve  
**Branch:** main

## Estado geral
A documentação fundacional e o pacote de pré-desenvolvimento existem. A implementação foi autorizada e está começando com scaffold de monorepo. Não afirmar que captura, transcrição ou integrações estejam validadas até haver testes executados e evidências registradas.

## Decisões consolidadas
- Produto: aplicativo desktop Windows primeiro e extensões Chrome/Firefox.
- Captura: usuário seleciona tela inteira, janela ou aba, em experiência semelhante ao compartilhamento do Meet.
- Processamento: exclusivamente áudio. Nenhuma análise visual, OCR, gravação ou persistência de quadros. Se uma API exigir trilha visual para iniciar a seleção, os quadros devem ser descartados imediatamente.
- Fonte: áudio da fonte selecionada; microfone opcional.
- Arquivos: áudio e vídeo importados; em vídeo, extrair somente áudio.
- Transcrição: ao vivo e pós-processamento, com timestamps.
- Falantes: diarização quando disponível, rótulos editáveis e sem inventar identidade.
- Análise: resumo, tópicos, perguntas/respostas, decisões, tarefas, responsáveis e prazos quando sustentados pelo conteúdo.
- Exportação: PDF/DOCX local.
- IA: BYOK; OpenAI, Gemini, Claude, Grok, outros provedores conhecidos e endpoints personalizados compatíveis ou adaptáveis.
- Arquitetura: TypeScript, React, Electron, pnpm workspaces, núcleo compartilhado e adaptadores.
- Privacidade: sem conta, backend próprio, analytics de conteúdo, sync ou histórico permanente no MVP.

## Estado de implementação
| Área | Estado |
|---|---|
| Documentação de produto/arquitetura | Concluída como especificação inicial |
| Decisões de produto | Consolidadas |
| Scaffold do monorepo | Em início de implementação |
| Núcleo de domínio | Não implementado |
| Aplicativo desktop | Não implementado |
| Extensão Chrome | Não implementada |
| Extensão Firefox | Não implementada |
| Captura de áudio | Não implementada nem validada |
| Adaptadores de IA | Não implementados |
| Relatórios/exportação | Não implementados |
| Testes automatizados | A configurar |

## Plano imediato
1. Criar monorepo pnpm com TypeScript.
2. Criar pacotes de domínio compartilhado e contratos de captura/provedores.
3. Criar scaffold Electron/React para desktop.
4. Criar scaffold WebExtension para Chrome/Firefox.
5. Adicionar scripts de lint, typecheck e testes.
6. Implementar núcleo de sessão e contratos de áudio sem acoplar a APIs ainda não validadas.
7. Evoluir captura, provedores e relatórios em etapas pequenas.

## Limitações e validações adiadas
O usuário autorizou prosseguir sem testes manuais imediatos. Assim, a implementação deve avançar por contratos e adaptadores, registrando como pendentes as validações de captura de áudio por fonte/SO/navegador, compatibilidade com VLC/Meet/Zoom/Teams, diarização, limites de arquivo, custos e qualidade dos provedores. Não anunciar tais capacidades como comprovadas.

## Histórico documental
Os documentos README, AGENTS e docs/00–15 permanecem como base. Decisões anteriores são preservadas no registro de decisões, com estados atualizados quando substituídas.
