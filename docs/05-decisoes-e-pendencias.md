# 05 — Decisões e pendências

Este registro distingue decisões já estabelecidas de recomendações e questões que exigem validação.

## Decisões estabelecidas
| ID | Decisão | Estado |
|---|---|---|
| D-001 | Nome do produto: Ouve | Aceita |
| D-002 | Produto será uma extensão de navegador | Aceita |
| D-003 | Compatibilidade-alvo: Google Chrome e Mozilla Firefox | Aceita |
| D-004 | Sem conta obrigatória no início | Aceita |
| D-005 | Sem histórico ou armazenamento permanente no MVP | Aceita |
| D-006 | Processamento temporário; usuário exporta e salva localmente se desejar | Aceita |
| D-007 | MVP prioriza análise de arquivos gravados | Aceita |
| D-008 | Português brasileiro como prioridade inicial | Aceita |
| D-009 | MVP inclui transcrição, falantes quando suportados, tópicos, resumo e relatório completo | Aceita |
| D-010 | Exportação inicial em PDF e DOCX | Aceita |
| D-011 | Acompanhamento ao vivo fica para etapa posterior | Aceita |
| D-012 | Arquitetura prevê BYOK e provedores intercambiáveis | Aceita |
| D-013 | Referência técnica: TypeScript, React e WebExtensions, com Manifest V3/adaptações | Diretriz aceita; validar no scaffold |

## Recomendações técnicas ainda sujeitas a validação
- Usar camadas de domínio/aplicação/adaptadores para desacoplar navegador e fornecedores.
- Fazer primeiro uma prova de conceito de importação, extração de áudio e transcrição antes de escolher bibliotecas definitivas.
- Escolher provedor comparando qualidade em português, timestamps, diarização, tamanho máximo, custo e política de dados.
- Manter a exportação local sempre que viável.

## Pendências prioritárias
| ID | Questão | Próxima ação |
|---|---|---|
| P-001 | Qual provedor de transcrição usar primeiro? | Comparar opções e custos reais |
| P-002 | Quais formatos e limites de arquivo aceitar? | Spike com formatos comuns e arquivos longos |
| P-003 | Como extrair áudio de cada formato no navegador? | Prova de conceito e análise de dependências/licenças |
| P-004 | Qual provedor/modelo fará análise textual? | Comparar qualidade, preço e privacidade |
| P-005 | Como armazenar e proteger a chave BYOK? | Avaliar armazenamento da extensão e ameaças |
| P-006 | Quais permissões mínimas serão necessárias? | Definir após fluxos e APIs escolhidos |
| P-007 | Como gerar PDF e DOCX no navegador? | Testar bibliotecas e qualidade do resultado |
| P-008 | Como lidar com arquivos maiores que limites de API/contexto? | Definir segmentação e consolidação |
| P-009 | Como será a captura ao vivo em Chrome e Firefox? | Provas de conceito independentes |
| P-010 | Quais modelos de relatório serão necessários por contexto? | Validar após MVP básico |
| P-011 | Qual licença será aplicada ao repositório? | Decisão do mantenedor |

## Regras de atualização
Toda nova decisão deve registrar: contexto, opções consideradas, decisão, justificativa, impactos, data e estado (proposta/aceita/substituída). Não apagar decisões substituídas; marcar como substituídas e apontar a decisão sucessora.
