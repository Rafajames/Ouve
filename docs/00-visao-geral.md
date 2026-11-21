# 00 — Visão geral do produto

## 1. Identidade
**Nome:** Ouve  
**Descrição:** Assistente inteligente de audiências e reuniões.  
**Formato:** extensão de navegador para Chrome e Firefox.

Ouve ajuda o usuário a compreender e organizar conversas faladas. O produto deve converter áudio e vídeo em transcrições e documentos estruturados, reduzindo o esforço de revisar reuniões ou audiências extensas.

## 2. Problema
Reuniões e audiências podem conter grande volume de informação, decisões, compromissos, perguntas e respostas. Revisar gravações manualmente consome tempo e dificulta localizar os pontos essenciais.

## 3. Proposta de valor
A partir de uma gravação ou sessão acompanhada, oferecer:
- transcrição organizada;
- identificação/rotulagem de falantes quando possível;
- divisão por tópicos;
- resumo e relatório detalhado;
- decisões, tarefas, prazos e encaminhamentos identificados com indicação de incerteza;
- exportação para uso externo.

Ouve é uma ferramenta de apoio à organização e análise. Não substitui julgamento profissional, ata oficial, assessoria jurídica ou conferência humana.

## 4. Público e cenários
Cenários prioritários incluem reuniões profissionais, reuniões administrativas, entrevistas, aulas/depoimentos e audiências. A linguagem do produto deve ser neutra e configurável para diferentes contextos.

## 5. Princípios
1. Privacidade e transparência por padrão.
2. Nenhuma conta obrigatória no MVP.
3. Nenhum histórico permanente no MVP.
4. Nenhum backend próprio no MVP.
5. Usuário controla início, pausa, encerramento, exportação e descarte.
6. Português brasileiro como prioridade inicial.
7. Resultados devem distinguir transcrição literal, resumo, inferência e informação incerta.
8. Arquitetura preparada para múltiplos provedores.

## 6. Limites do produto
- A qualidade da transcrição depende do áudio, idioma, ruído, sobreposição de vozes e provedor.
- Identificação de falantes é diarização/rotulagem, não reconhecimento biométrico de identidade. Não afirmar que sabe quem é uma pessoa sem informação fornecida pelo usuário.
- A IA pode omitir, interpretar incorretamente ou inventar relações. Relatórios precisam permitir conferência com a transcrição.
- Captura de áudio de abas, microfone e arquivos depende das permissões e APIs disponíveis em cada navegador.
- Recursos de reuniões ao vivo podem ter limitações específicas em páginas, sistemas de videoconferência e políticas do navegador.

## 7. Escopo por etapas
**MVP:** importar gravações, transcrever, organizar falantes e tópicos, gerar resumo/relatório e exportar PDF/DOCX.

**Etapa posterior:** captura e acompanhamento ao vivo, transcrição incremental e tópicos em tempo real.

**Futuro não comprometido:** contas, sincronização, colaboração, armazenamento em nuvem, integrações com plataformas específicas e recursos pagos. Tudo depende de decisão posterior.

## 8. Critério de sucesso do MVP
Uma pessoa consegue importar uma gravação suportada, acompanhar o processamento, revisar a transcrição e o relatório, exportar o resultado e encerrar a sessão sem que o Ouve mantenha histórico permanente.


## 9. Atualização de escopo — aplicativo desktop e captura externa
Ouve será planejado para duas interfaces: aplicativo desktop instalável, inicialmente Windows, e extensão para Chrome e Firefox. As experiências devem compartilhar o máximo possível do núcleo de domínio e aplicação, mantendo adaptadores próprios.

O usuário poderá deixar a audiência ou gravação aberta em outro monitor, em tela dividida ou em um aplicativo externo de reprodução, e selecionar no Ouve a tela inteira ou uma janela específica para análise. Em navegadores compatíveis, também poderá selecionar uma aba ou usar a extensão diretamente na aba da audiência. Não será necessário importar o vídeo nem reproduzi-lo dentro do Ouve nesse modo.

A captura serve exclusivamente para o Ouve observar e analisar o conteúdo autorizado pelo usuário. Não é compartilhamento com outras pessoas nem videoconferência. Captura visual não implica automaticamente captura de áudio do sistema; disponibilidade depende das APIs, permissões e restrições de cada navegador e sistema operacional.
