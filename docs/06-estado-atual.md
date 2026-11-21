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
