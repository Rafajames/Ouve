# 06 — Estado atual do projeto

**Atualizado em:** 20/11/2026  
**Repositório:** https://github.com/Rafajames/Ouve  
**Branch principal identificada:** main

## Situação verificada
- Repositório GitHub criado e público.
- No momento da inspeção inicial, o repositório não possuía commits/árvore Git.
- Documentação fundacional adicionada nesta atualização.
- Nenhuma funcionalidade de extensão foi considerada implementada ou testada.

## Documentos criados
- README.md
- AGENTS.md
- docs/00-visao-geral.md
- docs/01-especificacao-funcional.md
- docs/02-arquitetura-tecnica.md
- docs/03-privacidade-e-seguranca.md
- docs/04-roadmap.md
- docs/05-decisoes-e-pendencias.md
- docs/06-estado-atual.md

## Próxima etapa recomendada
Executar a Fase 0 do roadmap:
1. Criar scaffold da extensão.
2. Confirmar build para Chrome e Firefox.
3. Definir ferramentas de qualidade e testes.
4. Fazer prova de conceito de importação e extração de áudio.
5. Comparar provedores e registrar a escolha antes de integrar.

## Limitações conhecidas
- Provedor de transcrição ainda não escolhido.
- Provedor de análise ainda não escolhido.
- Formatos e limites máximos ainda não definidos.
- Captura ao vivo não validada.
- Permissões finais ainda não definidas.
- Política/licença do repositório ainda pendente.

## Regra de manutenção
Atualizar este arquivo ao final de cada etapa de desenvolvimento. Distinguir sempre o que está planejado, implementado, testado e publicado.


## Atualização de escopo — 20/11/2026
Decisões registradas após refinamento do produto:
- O Ouve será planejado em duas experiências: aplicativo desktop instalável (Windows primeiro) e extensão Chrome/Firefox.
- O usuário poderá selecionar tela, janela de aplicativo ou aba compatível para o Ouve acompanhar uma audiência/reunião.
- A audiência ou vídeo pode estar em outro monitor, em tela dividida ou reproduzindo em programa externo; não será obrigatório importar nem reproduzir o vídeo dentro do Ouve.
- A extensão também poderá operar diretamente na aba da audiência quando tecnicamente compatível.
- O compartilhamento é privado com o Ouve, não uma transmissão para participantes.
- Captura de áudio e captura visual precisam de provas de conceito separadas por ambiente. Nenhuma compatibilidade universal está confirmada.

## Próxima etapa revisada
1. Comparar Electron e Tauri para desktop Windows.
2. Fazer spikes de captura de tela/janela e áudio de sistema no desktop.
3. Fazer spikes de captura de aba/tela e áudio no Chrome e Firefox.
4. Definir arquitetura compartilhada de núcleo e adaptadores.
5. Atualizar roadmap e critérios de aceite após resultados.

Nenhum aplicativo desktop ou recurso de captura foi implementado/testado ainda.


## Pacote de pré-desenvolvimento — 20/11/2026
Foram adicionados documentos para orientar implementação:
- docs/07-blueprint-desenvolvimento.md
- docs/08-arquitetura-detalhada.md
- docs/09-integracoes-e-provedores.md
- docs/10-mcp-e-ferramentas-de-desenvolvimento.md
- docs/11-ambiente-e-configuracao.md
- docs/12-plano-de-testes-e-aceite.md
- docs/13-experiencia-e-telas.md
- docs/14-privacidade-legal-e-dados.md
- docs/15-backlog-inicial.md

README atualizado como índice central. O pacote descreve os dois produtos (desktop Windows primeiro e extensões Chrome/Firefox), modos de arquivo e captura externa, arquitetura em camadas, contratos de domínio, integração de provedores, MCP para desenvolvimento, ambiente, testes, UX, privacidade e backlog.

**Estado real:** documentação de pré-desenvolvimento consolidada; ainda não existe scaffold, código de produto, captura validada, provedor escolhido, instalador ou extensão funcional.

**Bloqueios técnicos antes de comprometer arquitetura:** prova de captura de áudio de sistema/janela externa no Windows; captura de aba e áudio no Chrome/Firefox; escolha Electron/Tauri; definição do workspace; seleção do primeiro provedor; formatos e limites de mídia.

**Próximo passo:** executar EPIC 0 em docs/15-backlog-inicial.md. Não começar integração de IA nem UI final antes de fechar os spikes e decisões listados.
