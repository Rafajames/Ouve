# 11 — Ambiente de desenvolvimento e configuração

## 1. Ambientes-alvo
- Desenvolvimento inicial: Windows 10/11, com testes em versões suportadas a definir.
- Extensão: Chrome e Firefox em versões estáveis suportadas.
- Desktop: Windows primeiro. macOS/Linux não são compromisso inicial.
- Idioma da interface: português brasileiro.

## 2. Pré-requisitos a fixar no bootstrap
- Node.js LTS compatível com framework escolhido.
- Um único gerenciador de pacotes/workspace.
- Git e acesso ao GitHub.
- Navegadores estáveis para teste.
- Ferramentas de build do desktop exigidas pelo framework escolhido.
- Espaço para dependências, artefatos de build e fixtures sintéticas.

Registrar versões exatas em arquivos de runtime/package manager e CI. Não assumir versões sem testar compatibilidade.

## 3. Arquivos de ambiente
Criar `.env.example` apenas com nomes de variáveis e descrições, sem valores reais. Arquivos `.env.local`, credenciais, certificados, tokens, chaves e arquivos de sessão devem estar no .gitignore.

Variáveis devem ser validadas na inicialização. Não embutir segredos em variáveis VITE_ ou equivalentes públicas.

## 4. Scripts esperados
Definir scripts consistentes na raiz:
- dev:desktop
- dev:extension:chrome
- dev:extension:firefox
- build:desktop
- build:extension:chrome
- build:extension:firefox
- typecheck
- lint
- format:check
- test
- test:e2e
- package:desktop

Os nomes podem ser adaptados ao framework, mas devem ser documentados e funcionar em CI.

## 5. Git
- main protegida quando o projeto tiver colaboradores.
- branches curtas por funcionalidade.
- commits pequenos e descritivos.
- PR com resumo, riscos, testes e evidência visual quando aplicável.
- nunca commitar gravações reais, dados pessoais, relatórios confidenciais, builds ou segredos.

## 6. CI mínima
Em pull requests: instalar dependências de forma reproduzível, typecheck, lint, testes unitários, build das extensões e build desktop quando runner compatível. Falhas bloqueiam merge. Artefatos de build não devem conter segredos.

## 7. Instalação e distribuição
Desenvolvimento local pode usar builds não assinados, com avisos. Distribuição pública Windows deverá avaliar assinatura de código, reputação do instalador, atualização segura, política de privacidade e canais oficiais. Não prometer ausência de alertas do Windows sem assinatura/reputação adequada.


## 8. Comandos implementados (21/11/2026)
```bash
pnpm install
pnpm dev:desktop            # Electron em modo desenvolvimento
pnpm lint && pnpm format:check
pnpm typecheck
pnpm test                   # testes unitários de todos os pacotes
pnpm build:desktop          # out/ (main, preload CJS, renderer)
pnpm build:extension        # apps/extension/dist/chrome e dist/firefox
xvfb-run -a pnpm test:e2e   # Linux sem tela; no Windows/macOS: pnpm test:e2e
pnpm --filter @ouve/desktop package   # instalador NSIS (executar no Windows; não validado)
```
Variáveis: `OUVE_FFMPEG_PATH` (ffmpeg alternativo), `OUVE_CHROME_PATH` (Chrome para o E2E da extensão). Variáveis `OUVE_E2E*` existem apenas para testes automatizados.
Carregar a extensão: Chrome → `chrome://extensions` → modo desenvolvedor → “Carregar sem compactação” → `apps/extension/dist/chrome`. Firefox → `about:debugging` → “Carregar extensão temporária” → `apps/extension/dist/firefox/manifest.json`.

## 9. Instalador Windows (21/11/2026)
A cada push em `desenvolvimento/**`, o workflow "Instalador Windows" gera `Ouve-Setup-<versão>.exe` e o publica na pré-release **teste-windows** (Releases do GitHub). O instalador não é assinado: o SmartScreen pode avisar; use "Mais informações → Executar assim mesmo". Geração local: `pnpm --filter @ouve/desktop package` no Windows, com `FFMPEG_BIN=ffmpeg.exe`.
