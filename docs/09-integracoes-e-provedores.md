# 09 — Integrações, provedores e serviços externos

## 1. Regra de seleção
Não integrar múltiplos provedores no primeiro incremento. Criar interfaces intercambiáveis e escolher um primeiro provedor após prova com gravações de teste em português brasileiro. Não assumir que um fornecedor cobre transcrição, diarização, áudio ao vivo e visão.

## 2. Categorias de integração
- Transcrição de arquivo.
- Transcrição em streaming/tempo real.
- Análise textual de transcrição.
- Análise visual/multimodal de quadros selecionados.
- Exportação PDF/DOCX.
- Captura de mídia do navegador/SO.

## 3. Matriz de avaliação obrigatória
Pontuar de 1 a 5 e registrar evidências:
- qualidade de pt-BR, sotaques e ruído;
- timestamps e diarização;
- streaming e latência;
- limites de duração/tamanho/formato;
- custo por hora/minuto e custo de análise;
- política de retenção, treinamento e exclusão;
- região de processamento e termos aplicáveis;
- SDK/API, estabilidade, rate limits e tratamento de erros;
- facilidade BYOK e riscos de exposição de chave no cliente.

## 4. BYOK e segurança
O usuário fornece suas próprias credenciais. Não incluir chaves no código, .env versionado, instalador ou extensão publicada. Usar armazenamento seguro do SO no desktop quando disponível; na extensão, documentar que segredo armazenado no perfil do navegador não tem proteção absoluta. Não enviar chaves ao núcleo de domínio nem a logs.

## 5. Custos
Antes de iniciar, mostrar provedor/modelo e, se possível, estimativa de custo baseada em duração/tokens. Nunca prometer custo exato quando o fornecedor cobrar por consumo variável. Exibir que o usuário paga diretamente ao provedor.

## 6. Política de dados
Para cada provedor, manter ficha em `docs/providers/` com data de verificação, dados enviados, finalidade, retenção, uso para treinamento, região, subprocessadores, limites e link oficial. Não afirmar “não treina” ou “apaga imediatamente” sem fonte oficial atual.

## 7. Estratégia de fallback
Falha de rede, cota ou autenticação deve gerar mensagem clara. Não trocar silenciosamente de provedor nem enviar dados a outro serviço sem consentimento explícito.

## 8. Serviços que não fazem parte do MVP
Backend próprio, login, sincronização, armazenamento em nuvem, analytics, telemetria de conteúdo e colaboração. Exigem decisão e documentação de impacto antes de qualquer implementação.
