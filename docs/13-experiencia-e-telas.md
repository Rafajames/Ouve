# 13 — Experiência do usuário e telas

> **23/11/2026:** a interface implementada segue o [padrão visual do docs/18](18-padrao-visual.md). Este documento guarda a visão original de telas.

## 1. Navegação principal
1. Início.
2. Nova análise.
3. Acompanhar ao vivo.
4. Importar gravação.
5. Sessão atual.
6. Relatórios (somente durante a sessão; sem histórico persistente no MVP).
7. Configurações: provedor, chave, idioma, captura, exportação e privacidade.

## 2. Tela inicial
Ações claras: “Acompanhar reunião/audiência” e “Analisar arquivo”. Exibir que a captura é privada e controlada pelo usuário.

## 3. Assistente de captura
Etapa 1: escolher fonte (monitor, janela, aba, microfone; opções indisponíveis desabilitadas com explicação).
Etapa 2: revisar capacidades detectadas: imagem, áudio da aba, áudio do sistema, microfone.
Etapa 3: mostrar aviso sobre permissões, autorização/consentimento e eventual envio a provedor externo.
Etapa 4: iniciar captura.

## 4. Espaço de acompanhamento
Layout ajustável com:
- estado e tempo de sessão;
- indicador visual de captura e fonte ativa;
- botões pausar/retomar, trocar fonte, encerrar;
- transcrição incremental;
- tópicos identificados;
- decisões e encaminhamentos provisórios;
- alertas de áudio ausente, falha, baixa confiança ou dessincronização.

Não esconder controles de parada. Não exibir “decisão confirmada” sem evidência.

## 5. Revisão de relatório
Abas/seções: resumo executivo, tópicos, transcrição, decisões, perguntas/respostas, tarefas/prazos, pendências. Cada item aponta trecho/timestamp quando disponível. Usuário edita e confirma antes da exportação.

## 6. Estados vazios e erros
Explicar o que fazer em linguagem simples. Exemplos: “Esta janela não disponibiliza áudio digital”; “O navegador não permite capturar esta aba neste contexto”; “A captura foi interrompida pelo sistema”; “A chave do provedor não foi aceita”. Nunca apresentar erro técnico bruto como única mensagem.

## 7. Acessibilidade
Teclado, foco visível, contraste, escala de texto, rótulos acessíveis, não depender apenas de cor e suporte a leitores de tela nas ações principais.
