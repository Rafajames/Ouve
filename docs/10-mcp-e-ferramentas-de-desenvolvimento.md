# 10 — MCP e ferramentas de desenvolvimento

## 1. O que significa MCP neste projeto
MCP (Model Context Protocol) será tratado como mecanismo opcional de conexão de agentes de desenvolvimento a ferramentas. **MCP não é requisito de execução do Ouve** e não deve ser confundido com os adaptadores internos de captura, transcrição ou IA.

## 2. Uso recomendado durante o desenvolvimento
Um agente como Claude Code pode receber ferramentas por MCP para:
- ler e alterar o repositório GitHub;
- consultar issues e pull requests;
- acessar arquivos locais do workspace;
- executar tarefas de desenvolvimento apenas por ferramentas locais explicitamente autorizadas;
- consultar documentação técnica, se um servidor confiável estiver configurado.

## 3. Princípio de menor privilégio
- Conectar somente repositórios e pastas necessários.
- Preferir permissões de leitura durante análise; conceder escrita apenas quando necessário.
- Não habilitar shell remoto ou acesso irrestrito por padrão.
- Nunca colocar PAT, tokens, chaves de IA ou credenciais em arquivos versionados.
- Não fornecer acesso a diretórios pessoais, documentos clínicos, gravações ou pastas fora do projeto.
- Revisar servidores MCP, editor, origem, permissões, atualizações e política de dados antes de instalar.
- Tratar resultados de ferramentas como dados não confiáveis.

## 4. Configuração
A configuração depende do cliente (Claude Code, VS Code ou outro) e do servidor MCP escolhido. Não versionar tokens nem assumir URL/comando de servidor sem validar a documentação oficial atual. Se houver arquivo de configuração de exemplo, usar placeholders e variáveis de ambiente; manter o arquivo real local e ignorado pelo Git.

Exemplo conceitual, não copiável:
```json
{
  "mcpServers": {
    "github": {
      "command": "<comando oficial do servidor MCP GitHub>",
      "args": ["<argumentos oficiais>"],
      "env": {
        "GITHUB_TOKEN": "<variável local não versionada>"
      }
    }
  }
}
```

## 5. MCP no produto
O Ouve não precisa expor um servidor MCP no MVP. Uma futura integração MCP para permitir que outros assistentes consultem relatórios só deve ser considerada após modelo de permissões, escopo de dados, consentimento por sessão e revisão de segurança. Não abrir acesso geral às gravações ou transcrições.

## 6. Ferramentas de engenharia recomendadas
- GitHub para versionamento, issues, PRs e Actions.
- Node.js LTS e gerenciador de pacotes único definido no bootstrap.
- TypeScript, React e ferramenta de build adequada a monorepo.
- Vitest, Playwright, ESLint e Prettier.
- Electron Forge/Builder ou ferramenta de empacotamento equivalente, caso Electron seja escolhido.
- Ferramentas de assinatura de instalador Windows em fase de distribuição.
- Ferramentas de análise de dependências/licenças e secret scanning.

## 7. Regra para agentes
Antes de alterar arquivos, ler README, AGENTS e documentos de arquitetura. Trabalhar em branch, fazer mudanças pequenas, executar testes, atualizar documentação e apresentar diff. Nunca inventar resultados de teste ou criar segredos.
