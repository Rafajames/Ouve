# 02 — Arquitetura técnica

## 1. Stack de referência
- TypeScript.
- React para interface da extensão.
- WebExtensions API.
- Manifest V3 para Chrome, com compatibilidade/adaptação para Firefox.
- Ferramentas de build e testes a selecionar no bootstrap, priorizando manutenção e compatibilidade.
- Adaptadores independentes para transcrição, IA e exportação.

A escolha final de bundler, framework de testes e bibliotecas de mídia deve ser registrada após um spike técnico. Não adicionar dependências pesadas sem justificativa.

## 2. Organização proposta
```text
/
├── README.md
├── AGENTS.md
├── docs/
│   ├── 00-visao-geral.md
│   ├── 01-especificacao-funcional.md
│   ├── 02-arquitetura-tecnica.md
│   ├── 03-privacidade-e-seguranca.md
│   ├── 04-roadmap.md
│   ├── 05-decisoes-e-pendencias.md
│   └── 06-estado-atual.md
├── src/
│   ├── background/
│   ├── content/
│   ├── popup/
│   ├── options/
│   ├── core/
│   │   ├── domain/
│   │   ├── application/
│   │   └── ports/
│   ├── adapters/
│   │   ├── browser/
│   │   ├── transcription/
│   │   ├── ai/
│   │   ├── media/
│   │   └── export/
│   └── shared/
├── public/
│   ├── chrome/
│   └── firefox/
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

A estrutura é uma proposta inicial; ajustar ao scaffold real sem criar pastas vazias desnecessárias.

## 3. Camadas
- **UI:** telas, estados, acessibilidade e revisão do relatório.
- **Application:** casos de uso (importar, processar, transcrever, analisar, exportar, descartar).
- **Domain:** modelos independentes de navegador e fornecedor.
- **Ports:** contratos para captura, transcrição, análise, armazenamento temporário e exportação.
- **Adapters:** implementações concretas de APIs do navegador e serviços externos.

## 4. Modelos de domínio iniciais
- `Session`: identificador efêmero, estado, origem, idioma e horários da sessão.
- `MediaAsset`: metadados do arquivo e referência temporária ao conteúdo.
- `TranscriptSegment`: texto, início/fim, falante opcional e confiança opcional.
- `Speaker`: identificador local e rótulo editável.
- `Topic`: título, resumo, intervalo temporal e segmentos associados.
- `Decision`: descrição, evidência/trecho e timestamp opcional.
- `ActionItem`: tarefa, responsável mencionado, prazo mencionado e evidência.
- `Report`: resumo, seções, pendências e referências à transcrição.
- `ProviderConfig`: identificador do provedor e configuração; segredo tratado separadamente.

Modelos devem representar incerteza e ausência de dados. Não transformar inferências em fatos confirmados.

## 5. Portas e adaptadores
Criar contratos como:
- `TranscriptionProvider`: transcrever arquivo/áudio e devolver segmentos.
- `AnalysisProvider`: analisar transcrição e produzir estrutura validável.
- `MediaProcessor`: validar, extrair e preparar áudio.
- `ReportExporter`: exportar PDF/DOCX.
- `TemporarySessionStore`: manter dados apenas durante a sessão.
- `BrowserCaptureAdapter`: interface futura para captura, com implementações específicas por navegador.

A implementação de cada provedor deve declarar limites de tamanho, idiomas, timestamps, diarização, política de retenção, região de processamento, custo e requisitos de autenticação.

## 6. Fluxo de processamento sugerido
Importação → validação → extração/preparação → transcrição → normalização de segmentos → análise estruturada → validação do resultado → revisão humana → exportação.

Não enviar arquivos inteiros a um modelo de linguagem quando uma transcrição normalizada for suficiente. Minimizar dados enviados e considerar limites de contexto, divisão em blocos e consolidação.

## 7. Extensão e compatibilidade
- Encapsular APIs de navegador em adaptadores.
- Não espalhar chamadas diretas de `chrome.*` ou `browser.*` pelo domínio.
- Validar permissões e manifestos em ambos os navegadores.
- Verificar diferenças de background/service worker, captura e downloads.
- Não assumir que APIs disponíveis no Chrome existem no Firefox ou vice-versa.

## 8. Chaves e chamadas externas
BYOK não significa que qualquer chave possa ser armazenada sem risco. Preferir armazenamento local protegido pelo navegador, limitar acesso à chave, nunca registrar segredo em logs e informar que extensões não oferecem proteção absoluta contra comprometimento do perfil/dispositivo. Não usar proxy/backend próprio no MVP.

## 9. Qualidade
- Typecheck, lint, testes unitários e build.
- Testes de contrato para adaptadores de provedores.
- Fixtures sintéticas ou autorizadas; não versionar gravações reais confidenciais.
- Testes manuais em Chrome e Firefox.
- Medir memória, duração e limites com arquivos de teste.
