# Ouve
### Assistente inteligente de audiências e reuniões

Ouve é um aplicativo desktop e extensão de navegador para capturar áudio de uma fonte escolhida, transcrever, organizar e analisar reuniões, audiências e gravações.

## Escopo confirmado
- Aplicativo desktop para Windows como primeira plataforma.
- Extensões para Google Chrome e Mozilla Firefox.
- O usuário seleciona tela, janela ou aba, em uma experiência semelhante ao compartilhamento do Google Meet.
- **O processamento do Ouve é exclusivamente de áudio.** Não grava tela, não analisa imagens, não executa OCR e não armazena quadros. Se uma API exigir uma trilha visual para iniciar o seletor, os quadros devem ser descartados imediatamente.
- Áudio da fonte selecionada e microfone opcional.
- Importação de arquivos de áudio e vídeo; em vídeo, somente a faixa de áudio será extraída.
- Transcrição ao vivo e posterior, diarização quando disponível, resumo, tópicos, perguntas/respostas, decisões e tarefas.
- Relatórios editáveis e exportação local PDF/DOCX.
- BYOK: OpenAI, Gemini, Claude, Grok, outros provedores e endpoints personalizados compatíveis/adaptáveis.

## Princípios
- Sem conta obrigatória, backend próprio, sincronização ou histórico permanente no MVP.
- Processamento temporário; usuário controla exportação e destino.
- Captura explícita, indicador persistente e controles de pausa/parada.
- Português brasileiro como prioridade.
- Chaves protegidas localmente; nunca incluir segredos em código, commits ou logs.
- Resultados de IA devem preservar evidências e incertezas.

## Estado
**Desenvolvimento iniciado.** O repositório está recebendo o scaffold e o núcleo compartilhado. Captura real, compatibilidade entre plataformas e integrações de provedores ainda não foram validadas. Consulte [Estado atual](docs/06-estado-atual.md).

## Começar
Requisitos: Node.js 20+ e pnpm 9+.

```bash
pnpm install
pnpm dev:desktop
pnpm typecheck
pnpm test
```

Os scripts serão ampliados conforme os pacotes forem implementados.

## Estrutura
- `apps/desktop`: aplicativo Electron + React.
- `apps/extension`: base da extensão Chrome/Firefox.
- `packages/core`: domínio e contratos compartilhados.
- `docs/`: especificações, arquitetura, decisões e backlog.

## Documentação
- [Visão geral](docs/00-visao-geral.md)
- [Especificação funcional](docs/01-especificacao-funcional.md)
- [Blueprint](docs/07-blueprint-desenvolvimento.md)
- [Arquitetura detalhada](docs/08-arquitetura-detalhada.md)
- [Integrações e provedores](docs/09-integracoes-e-provedores.md)
- [MCP e ferramentas](docs/10-mcp-e-ferramentas-de-desenvolvimento.md)
- [Ambiente](docs/11-ambiente-e-configuracao.md)
- [Testes e aceite](docs/12-plano-de-testes-e-aceite.md)
- [UX e telas](docs/13-experiencia-e-telas.md)
- [Privacidade](docs/14-privacidade-legal-e-dados.md)
- [Backlog](docs/15-backlog-inicial.md)
- [Decisões](docs/05-decisoes-e-pendencias.md)
- [Estado atual](docs/06-estado-atual.md)
- [Instruções para agentes](AGENTS.md)

## Precisão
Documentação e interfaces iniciais não equivalem a compatibilidade comprovada. Não anunciar captura de áudio, suporte a um aplicativo, duração máxima ou qualidade de provedor como garantidos antes de testes documentados.
