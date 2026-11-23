# 12 — Plano de testes e critérios de aceite

## 1. Testes de domínio
- normalização de timestamps;
- ordenação e união de segmentos;
- associação de evidências a tópicos/decisões/tarefas;
- estados de sessão e transições válidas;
- validação de respostas estruturadas;
- descarte e cancelamento.

## 2. Testes de captura
Matriz mínima:
- Windows, monitor único;
- Windows, dois monitores;
- janela de navegador;
- aba Chrome;
- aba Firefox;
- reprodutor externo (ex.: VLC);
- tela dividida;
- microfone;
- áudio de sistema/loopback;
- pausa, retomada, troca de fonte e encerramento.

Para cada caso registrar: vídeo capturado? áudio capturado? fonte do áudio? sincronização? limitações? consumo? permissões? resultado e versão testada.

## 3. Testes de arquivo
Formatos candidatos devem ser confirmados por spike. Testar arquivo válido, corrompido, vazio, grande, duração longa, codec não suportado, ausência de áudio e cancelamento durante processamento.

## 4. Testes de IA/provedores
Usar corpus de teste autorizado ou sintético em pt-BR com ruído, sotaques, sobreposição, nomes próprios, datas, números, perguntas, decisões e tarefas. Medir WER quando houver referência, precisão de timestamps, diarização e fidelidade das extrações. Avaliar custo por hora de áudio.

## 5. Testes de privacidade e segurança
- nenhuma captura sem ação explícita;
- indicador sempre visível;
- pausar/parar encerra tracks e recursos;
- não há upload antes de confirmação;
- não há conteúdo sensível em logs;
- segredos ausentes de bundle e commits;
- sessão não persiste após encerramento, salvo exportação feita pelo usuário;
- falhas não provocam envio a outro fornecedor;
- IPC e mensagens entre contextos validados.

## 6. Testes de exportação
PDF e DOCX abrem corretamente, preservam acentos, títulos, timestamps, tabelas e paginação básica. Exportação reflete edições feitas pelo usuário.

## 7. Critérios de aceite do primeiro MVP
- Desktop Windows e extensões Chrome/Firefox compilam.
- Importação e análise de gravação funcionam com primeiro provedor selecionado.
- Usuário revisa e exporta PDF/DOCX.
- Captura privada tem prova funcional por fonte declarada como suportada.
- UI informa capacidades reais de áudio/vídeo.
- Pausa, encerramento, cancelamento e descarte funcionam.
- Testes automatizados e manuais documentados.
- Nenhuma conta, backend próprio ou histórico permanente.


## 8. Evidências automatizadas (21/11/2026)
Executadas localmente (Linux, Node 22) antes do push:
- 76 testes unitários (Vitest) em 9 pacotes/apps: shared 9, core 12, capture 13, providers 14, transcription 5, analysis 6, reports 4, desktop 8, extension 5.
- Desktop: teste com ffmpeg real extrai somente o áudio de um MP4 gerado, em segmentos WAV mono, e apaga os temporários.
- E2E Electron (Playwright, 5 testes): tela inicial; configuração de provedor compatível em servidor local falso e teste de conexão; consentimento obrigatório e ausência de imagens no seletor; importação → transcrição → análise (validador remove responsável inventado) → exportação PDF e DOCX; descarte da sessão.
- E2E extensão (Playwright + Chromium, 2 testes): extensão carrega, página renderiza sem erros, consentimento obrigatório no popup e na página.
- Verificação visual do PDF gerado (acentos e paginação).

Não coberto por automação (depende de hardware/gesto real): captura de tela/janela com loopback no Windows, captura de aba no Chrome, microfone real, qualidade dos provedores, sessões de 4 h e arquivos de 2 GB.
