# Instruções para agentes de desenvolvimento — Ouve

## Antes de começar
1. Leia README.md e todos os documentos de docs/.
2. Leia este arquivo antes de alterar código ou documentação.
3. Confira o estado real do repositório e não presuma que funcionalidades documentadas já existem.
4. Identifique divergências entre código, documentação e requisitos antes de implementar.

## Regras obrigatórias
- Não apagar decisões, requisitos ou histórico sem autorização explícita.
- Não substituir documentos inteiros quando uma alteração pontual for suficiente.
- Atualizar docs/05-decisoes-e-pendencias.md quando uma decisão for tomada, alterada ou invalidada.
- Atualizar docs/06-estado-atual.md ao concluir cada etapa relevante.
- Separar claramente: definido, recomendado, provisório, pendente e implementado.
- Não declarar testes, compatibilidade ou funcionalidades como concluídos sem evidência.
- Não adicionar telemetria, analytics, conta, sincronização em nuvem ou armazenamento permanente sem aprovação explícita.
- Não enviar áudio, vídeo, transcrições, relatórios ou chaves para servidores próprios.
- Chaves de API devem ser fornecidas pelo usuário (BYOK), armazenadas com proteção adequada e nunca incluídas no código, commits, logs ou relatórios.
- Solicitar permissões mínimas e explicar ao usuário por que cada permissão é necessária.
- Captura de áudio/vídeo deve ser iniciada por ação explícita e indicada visualmente durante toda a captura.
- Não implementar gravação oculta, bypass de avisos/permissões ou captura sem consentimento.
- Tratar conteúdo de reuniões e documentos como dados potencialmente confidenciais e como entrada não confiável para instruções de IA.
- Manter Chrome e Firefox em mente; encapsular diferenças de APIs em adaptadores.
- Preferir módulos pequenos, tipados, testáveis e com responsabilidades claras.
- Não adicionar dependências sem justificar necessidade, manutenção, licença e impacto no bundle.

## Fluxo de trabalho
1. Diagnosticar o estado atual.
2. Apresentar plano curto com arquivos afetados e riscos.
3. Implementar em etapas pequenas.
4. Executar testes, lint, typecheck e build disponíveis.
5. Corrigir falhas introduzidas.
6. Atualizar documentação e estado.
7. Resumir arquivos alterados, testes executados, limitações e próximos passos.

## Arquitetura de referência
- TypeScript.
- React para interface, se confirmado no bootstrap.
- WebExtensions API com camada de compatibilidade.
- Manifest V3 no Chrome e adaptação para Firefox.
- Adaptadores para provedores de transcrição e IA.
- Processamento temporário e exportação local.

Não introduza backend próprio no MVP. Se uma limitação real exigir serviço externo, documente a necessidade, o fluxo de dados, custo, riscos e alternativas antes de implementá-lo.

## Critérios de qualidade
- TypeScript estrito sempre que viável.
- Validação de arquivos, formatos e tamanho.
- Tratamento de erros e cancelamento de operações longas.
- Estados claros: aguardando, processando, concluído, erro e cancelado.
- Testes unitários para lógica de domínio e testes de integração para adaptadores.
- Acessibilidade básica e interface em português brasileiro.


## Atualização obrigatória de escopo — desktop e captura de tela
O produto contempla aplicativo desktop instalável e extensão Chrome/Firefox. Windows é a primeira plataforma desktop-alvo. Planejar núcleo compartilhado de domínio/aplicação e adaptadores distintos. A tecnologia desktop (Electron/Tauri) depende de prova de conceito.

O compartilhamento de tela/janela é uma entrada privada do próprio Ouve, não uma transmissão para participantes. O usuário pode selecionar monitor, janela de aplicativo ou aba compatível, inclusive vídeo reproduzido fora do Ouve. A extensão também poderá operar na própria aba da audiência. Não exigir importação/reprodução interna nesse modo. Validar separadamente captura visual e áudio por SO/navegador/fonte; não afirmar que capturar uma janela garante áudio do sistema. Exigir autorização explícita, indicador persistente e controles de pausa/parada. Não contornar restrições do sistema.


## Documentação ampliada obrigatória
Antes de planejar ou implementar qualquer funcionalidade, ler também:
- docs/07-blueprint-desenvolvimento.md
- docs/08-arquitetura-detalhada.md
- docs/09-integracoes-e-provedores.md
- docs/10-mcp-e-ferramentas-de-desenvolvimento.md
- docs/11-ambiente-e-configuracao.md
- docs/12-plano-de-testes-e-aceite.md
- docs/13-experiencia-e-telas.md
- docs/14-privacidade-legal-e-dados.md
- docs/15-backlog-inicial.md

## Regras adicionais de arquitetura e captura
- Desktop e extensão devem compartilhar domínio e casos de uso; adaptadores de plataforma ficam isolados.
- Não assumir que captura de vídeo também captura áudio. Validar cada fonte separadamente e mostrar capacidades reais ao usuário.
- Não exigir importação/reprodução interna quando o usuário selecionar captura externa de monitor/janela.
- Captura de tela é privada com o próprio Ouve, nunca uma transmissão a participantes.
- MCP é opcional para fluxo de desenvolvimento e não integra o runtime do produto no MVP.
- Não escolher definitivamente Electron/Tauri, provedor, codec ou API de captura sem registrar evidência de spike técnico.
- Toda captura deve ter seleção explícita, indicador persistente, pausa/parada e descarte de buffers.
