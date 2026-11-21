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


## 10. Arquitetura multiplataforma: desktop + extensão
O produto terá aplicativo desktop instalável (Windows primeiro) e extensão Chrome/Firefox. A tecnologia desktop (Electron, Tauri ou alternativa) será escolhida após spike comparativo. Compartilhar modelos de domínio, casos de uso, pipeline de transcrição/análise e geração de relatórios; manter adaptadores específicos para captura, permissões, ciclo de vida e armazenamento temporário.

## 11. Captura de tela/janela e mídia externa
Definir uma porta de captura capaz de selecionar fontes suportadas e fornecer fluxos de vídeo e áudio separados, com timestamps. Na extensão, usar APIs de captura oferecidas pelo navegador. No desktop, usar APIs do framework/SO para selecionar monitor ou janela e obter áudio de sistema quando permitido.

O usuário poderá selecionar a janela de um reprodutor externo ou o monitor em que a audiência está aberta. Não será necessário importar o arquivo nem reproduzi-lo no Ouve. A captura é privada e destinada somente à análise no Ouve, sem transmissão a terceiros. Exigir autorização explícita, indicador visível persistente e controles de pausa/parada.

Captura de vídeo não garante captura de áudio do sistema. Validar por combinação de SO, navegador, framework e fonte: loopback, permissões, seleção de dispositivo, sincronização A/V, múltiplos monitores, janelas minimizadas, aceleração de hardware e DRM/conteúdo protegido.

## 12. Spikes técnicos obrigatórios
1. Captura de aba no Chrome com vídeo e áudio.
2. Mapear captura equivalente e diferenças no Firefox.
3. Capturar monitor/janela externa no Windows e validar áudio de sistema/loopback.
4. Testar VLC, dois monitores e tela dividida.
5. Comparar Electron e Tauri em captura, áudio, empacotamento, tamanho, consumo e manutenção.
6. Medir sincronização A/V e estratégia de amostragem de quadros sem retenção permanente de vídeo.
