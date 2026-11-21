# Ouve
### Assistente inteligente de audiências e reuniões

Ouve é uma extensão de navegador para acompanhar, transcrever, organizar e analisar reuniões, audiências e gravações de áudio/vídeo. O objetivo é transformar conversas longas em informação estruturada e relatórios úteis, mantendo o usuário no controle dos dados.

> **Estado do projeto:** documentação inicial consolidada; implementação ainda não iniciada.
> **Escopo inicial:** extensão para Google Chrome e Mozilla Firefox.

## Princípios do produto
- **Privacidade primeiro:** sem conta obrigatória, sem backend próprio e sem histórico permanente no MVP.
- **Processamento temporário:** o conteúdo é processado durante a sessão; o usuário decide se deseja exportar e salvar o resultado localmente.
- **Controle explícito:** captura e análise só começam por ação do usuário, com indicação visível de gravação/captura.
- **Português em primeiro lugar:** priorizar transcrição e análise em português brasileiro.
- **Arquitetura extensível:** provedores de IA/transcrição intercambiáveis, sem acoplar o produto a um fornecedor.
- **Compatibilidade multiplataforma:** Chrome e Firefox por meio de WebExtensions e adaptações específicas por navegador.

## Funcionalidades previstas
### MVP — análise de gravações
1. Importar arquivo de áudio ou vídeo.
2. Extrair/processar áudio e gerar transcrição em português.
3. Organizar a conversa por falantes quando tecnicamente possível.
4. Identificar tópicos, assuntos, decisões, encaminhamentos e pontos relevantes.
5. Gerar relatório completo e resumo executivo.
6. Exportar o resultado em PDF e DOCX.
7. Permitir descarte da sessão sem manter histórico no produto.

### Evolução posterior
- Acompanhamento e transcrição de reuniões/audiências ao vivo.
- Organização de tópicos em tempo real.
- Geração progressiva de notas e relatório durante a sessão.
- Melhorias de diarização, busca e análise configurável.

## Documentação
- [Visão geral e escopo](docs/00-visao-geral.md)
- [Especificação funcional](docs/01-especificacao-funcional.md)
- [Arquitetura técnica](docs/02-arquitetura-tecnica.md)
- [Privacidade e segurança](docs/03-privacidade-e-seguranca.md)
- [Roadmap](docs/04-roadmap.md)
- [Decisões e pendências](docs/05-decisoes-e-pendencias.md)
- [Estado atual](docs/06-estado-atual.md)
- [Orientações para agentes de desenvolvimento](AGENTS.md)

## Diretriz importante
A documentação descreve o comportamento desejado, não funcionalidades já implementadas. Toda limitação técnica, custo de API, permissão de navegador e compatibilidade deve ser validada antes de ser apresentada como garantida.

## Desenvolvimento
A stack de referência é TypeScript, React e WebExtensions, com Manifest V3 no Chrome e adaptação compatível no Firefox. Consulte a arquitetura antes de criar a estrutura de código.

## Licença
Ainda não definida. Não assumir licença permissiva até decisão explícita do mantenedor.


## Atualização de escopo — 20/11/2026
O produto será planejado desde o início para duas experiências: aplicativo desktop instalável (Windows como primeira plataforma-alvo) e extensão para Chrome e Firefox.

### Acompanhamento por compartilhamento privado de tela/janela
O usuário poderá manter a audiência, reunião ou gravação em outro monitor, em tela dividida ou em outro aplicativo (por exemplo, um reprodutor de vídeo), e selecionar essa tela/janela no próprio Ouve. Também poderá usar a extensão diretamente na aba da audiência, quando compatível. Não será obrigatório importar nem reproduzir o vídeo dentro do Ouve nesse modo. O compartilhamento é uma fonte privada de captura/análise para o Ouve, não uma transmissão a terceiros. Captura visual e captura de áudio são capacidades distintas; áudio do sistema/aba depende de permissões e APIs específicas de cada ambiente e precisa ser validado.
