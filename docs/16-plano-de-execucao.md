# 16 — Plano de execução

## Objetivo
Dar início ao desenvolvimento sem depender de validação manual imediata. A implementação deve avançar em camadas, com testes automatizados e pontos de validação de plataforma claramente marcados.

## Etapa atual — scaffold
- Monorepo pnpm.
- Pacote @ouve/core para domínio e contratos.
- Aplicativo Electron + React.
- Base de extensão WebExtensions.
- Scripts de build, typecheck e teste.

## Próxima etapa
1. Instalar dependências e gerar lockfile.
2. Executar typecheck e testes; corrigir erros de scaffold.
3. Criar contratos completos de sessão, áudio, provedores e relatórios.
4. Implementar máquina de estados e armazenamento temporário.
5. Implementar adaptador de captura desktop, sem afirmar compatibilidade até validar.
6. Criar adaptadores de navegador e UX de permissões.
7. Implementar provedor inicial de transcrição e configuração BYOK.
8. Construir análise, edição e exportação.

## Regras para trabalho sem ambiente de captura
- Implementar interfaces e adaptadores com tratamento explícito de capacidades indisponíveis.
- Não simular áudio real nem habilitar botões que aleguem capturar quando não há implementação.
- Não declarar sucesso de captura com base apenas na compilação.
- Manter testes unitários para lógica pura e testes de contrato para adaptadores.
- Registrar cada limitação em docs/05 e docs/06.

## Critério de conclusão do scaffold
- Estrutura de workspace coerente.
- Dependências instaláveis.
- Build desktop e extensão executáveis.
- Typecheck sem erros.
- Testes do núcleo passando.
- CI configurada ou pronta para ser ativada.
