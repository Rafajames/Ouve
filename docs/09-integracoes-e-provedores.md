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


## 9. Adaptadores implementados (21/11/2026)
Não houve validação com chaves reais. Diferenças entre APIs tratadas pelos adaptadores:

| Provedor | Transcrição | Análise | Autenticação | Observações |
|---|---|---|---|---|
| OpenAI | `POST /audio/transcriptions` (multipart). `whisper-1` → `verbose_json` com segmentos e confiança; `gpt-4o-transcribe`/`mini` → `json` (texto por bloco); `*-diarize` → `diarized_json` com falantes | `POST /chat/completions` com `response_format: json_object` | `Authorization: Bearer` | Limite de 25 MB por arquivo |
| Compatível com OpenAI / personalizado | Mesmo formato, se o servidor implementar | Idem; se recusar `response_format` (HTTP 400), repete sem ele | Bearer (opcional em localhost) + cabeçalhos extras não secretos | HTTP só para localhost |
| xAI Grok | Não habilitada | `chat/completions` compatível | Bearer | Base `https://api.x.ai/v1` |
| Google Gemini | `generateContent` com áudio inline (base64) e instrução para JSON de segmentos — timestamps e falantes **estimados pelo modelo** | `generateContent` com `responseMimeType: application/json` | Cabeçalho `x-goog-api-key` (nunca na URL) | Bloqueio de conteúdo vira erro explícito |
| Anthropic Claude | Não oferece | `POST /messages` (`anthropic-version: 2023-06-01`) | `x-api-key` | JSON solicitado por instrução; resposta validada |

Tratamento comum: timeout por requisição (padrão 120 s), até 2 novas tentativas com backoff para rede/429/5xx/timeout, cancelamento por `AbortSignal`, mensagens em pt-BR sem ecoar corpo de resposta, limitador de taxa disponível (`RateLimiter`).
Nunca há troca silenciosa de provedor: o usuário escolhe um provedor para transcrição e outro (ou o mesmo) para análise.
