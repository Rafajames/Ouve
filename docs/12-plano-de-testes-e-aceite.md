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
