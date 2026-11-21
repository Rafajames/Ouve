# Ouve
### Assistente inteligente de audiências e reuniões

Ouve é um assistente privado para acompanhar, transcrever, organizar e analisar reuniões, audiências e gravações. O objetivo é transformar conversas longas em informação estruturada e relatórios úteis, mantendo o usuário no controle dos dados.

> **Estado:** pacote de pré-desenvolvimento documentado. Nenhuma funcionalidade de produto está implementada ainda.

## Produto planejado
- Aplicativo desktop instalável, Windows como primeira plataforma.
- Extensão para Google Chrome e Mozilla Firefox.
- Análise de arquivos de áudio/vídeo.
- Captura privada de tela, janela ou aba compatível, inclusive quando a audiência/vídeo está em outro monitor ou aplicativo.
- Transcrição, tópicos, decisões, perguntas/respostas, tarefas, responsáveis e prazos mencionados.
- Relatório editável e exportação local em PDF/DOCX.

A captura de tela é uma entrada privada do próprio Ouve, não uma transmissão a terceiros. Não é obrigatório importar ou reproduzir o vídeo dentro do Ouve para usar o modo de captura externa. A disponibilidade de áudio depende das APIs e permissões de cada ambiente e será validada por provas técnicas.

## Princípios
- Sem conta obrigatória, backend próprio ou histórico permanente no MVP.
- Processamento temporário; usuário escolhe se exporta e onde salva.
- Captura iniciada explicitamente, com indicador visível e controles de pausa/parada.
- Português brasileiro como prioridade.
- Provedores intercambiáveis e BYOK.
- Nenhum conteúdo confidencial em logs, analytics ou telemetria.
- Resultados de IA com evidências e indicação de incerteza.

## Documentação
### Produto e requisitos
- [Visão geral](docs/00-visao-geral.md)
- [Especificação funcional](docs/01-especificacao-funcional.md)
- [Blueprint de desenvolvimento](docs/07-blueprint-desenvolvimento.md)
- [Experiência e telas](docs/13-experiencia-e-telas.md)

### Engenharia
- [Arquitetura técnica inicial](docs/02-arquitetura-tecnica.md)
- [Arquitetura detalhada e contratos](docs/08-arquitetura-detalhada.md)
- [Integrações e provedores](docs/09-integracoes-e-provedores.md)
- [MCP e ferramentas de desenvolvimento](docs/10-mcp-e-ferramentas-de-desenvolvimento.md)
- [Ambiente e configuração](docs/11-ambiente-e-configuracao.md)
- [Plano de testes e aceite](docs/12-plano-de-testes-e-aceite.md)
- [Backlog inicial](docs/15-backlog-inicial.md)

### Governança
- [Privacidade e segurança](docs/03-privacidade-e-seguranca.md)
- [Privacidade, consentimento e dados](docs/14-privacidade-legal-e-dados.md)
- [Roadmap](docs/04-roadmap.md)
- [Decisões e pendências](docs/05-decisoes-e-pendencias.md)
- [Estado atual](docs/06-estado-atual.md)
- [Instruções para agentes](AGENTS.md)

## Próxima etapa
Executar o EPIC 0 do backlog: validar tecnologia desktop e captura, confirmar monorepo e ferramentas, selecionar primeiro provedor e criar scaffold/CI. Só depois iniciar funcionalidades do produto.

## Regra de precisão
A documentação descreve requisitos e planos, não capacidades implementadas. Compatibilidade, captura de áudio, limites de arquivo, custos e políticas de fornecedores só podem ser anunciados após testes e verificação.
