# 01 — Especificação funcional

## 1. Escopo do MVP
O primeiro incremento funcional deve priorizar análise posterior de arquivos gravados. A captura ao vivo é uma etapa seguinte, para reduzir riscos técnicos e validar primeiro o pipeline de áudio, transcrição e relatório.

## 2. Fluxo principal
1. Usuário abre a extensão.
2. Seleciona análise de gravação.
3. Escolhe arquivo de áudio ou vídeo em formato suportado.
4. O sistema valida formato, tamanho, duração e possibilidade de extração do áudio.
5. Exibe as configurações de processamento e o provedor selecionado.
6. Usuário confirma o início.
7. Sistema extrai/prepara áudio, envia somente ao provedor externo escolhido quando necessário e apresenta progresso.
8. Sistema recebe transcrição e metadados disponíveis.
9. Organiza falantes e tópicos, gera resumo e relatório.
10. Usuário revisa e ajusta o resultado.
11. Usuário exporta PDF ou DOCX, ou descarta a sessão.

## 3. Requisitos funcionais

### RF-01 — Importação
Permitir selecionar arquivo local de áudio ou vídeo. A lista exata de extensões e limites deve ser definida após protótipo técnico. Validar MIME, extensão, tamanho e conteúdo sempre que possível; não confiar apenas no nome do arquivo.

### RF-02 — Preparação de áudio
Extrair ou converter áudio para formatos aceitos pelo provedor, com limites documentados. Operações longas devem permitir cancelamento e apresentar erros compreensíveis.

### RF-03 — Transcrição
Produzir texto com marcações de tempo quando o provedor oferecer esse recurso. Português brasileiro é a prioridade. Preservar a referência temporal sempre que disponível.

### RF-04 — Falantes
Separar segmentos por falante quando o provedor ou pipeline suportar diarização. Usar rótulos neutros (Falante 1, Falante 2...). Permitir renomear rótulos manualmente. Não inferir identidade pessoal pela voz.

### RF-05 — Organização temática
Agrupar a conversa em tópicos e subtópicos. Sempre que possível, associar os tópicos a intervalos de tempo da gravação.

### RF-06 — Extração de informações
Identificar, quando presentes:
- assuntos discutidos;
- decisões e deliberações;
- perguntas e respostas;
- tarefas e encaminhamentos;
- responsáveis mencionados;
- prazos e datas mencionados;
- pontos em aberto e divergências.

Não inventar responsável, prazo ou decisão. Quando não houver evidência, indicar “não identificado” ou “não mencionado”.

### RF-07 — Relatórios
Gerar:
- **Resumo:** visão concisa dos pontos centrais.
- **Relatório completo:** tópicos, falantes, decisões, tarefas, prazos, pendências e referências temporais disponíveis.

### RF-08 — Revisão
Permitir revisar e editar texto, nomes dos falantes e conteúdo do relatório antes da exportação. Alterações manuais devem refletir no documento exportado.

### RF-09 — Exportação
Permitir exportar PDF e DOCX. A exportação deve ocorrer localmente sempre que viável. Informar claramente quando um recurso ou formato não estiver disponível.

### RF-10 — Sessão temporária
Não criar conta nem histórico permanente no MVP. Ao encerrar, permitir exportar ou descartar. Limpar dados temporários e URLs de objeto ao encerrar ou cancelar; documentar limitações de memória/cache do navegador.

### RF-11 — Configuração de provedor
Suportar arquitetura BYOK (Bring Your Own Key): o usuário fornece sua própria chave para o provedor compatível. A interface deve informar que custos e termos do provedor são responsabilidade do usuário. Nunca embutir segredo de API no pacote da extensão.

### RF-12 — Erros e recuperação
Exibir erros de formato, limite, rede, autenticação, cota e indisponibilidade. Não perder silenciosamente conteúdo ainda não exportado; alertar o usuário sobre riscos antes de descartar a sessão.

## 4. Etapa ao vivo — fora do primeiro MVP
Requisitos previstos:
- iniciar captura por ação explícita;
- selecionar fonte disponível (aba, microfone ou outra fonte autorizada);
- indicador persistente de captura;
- pausar/retomar/finalizar;
- transcrição incremental;
- identificação provisória de falantes;
- tópicos e notas atualizados progressivamente;
- relatório final após encerramento.

A viabilidade de captura de áudio de abas e microfone deve ser validada separadamente em Chrome e Firefox. Não prometer captura universal de áudio do sistema.

## 5. Requisitos não funcionais
- Interface em português brasileiro.
- Acessibilidade por teclado e foco visível.
- Feedback de progresso e operações canceláveis.
- Proteção de chaves e dados sensíveis.
- Compatibilidade entre navegadores por adaptadores.
- Desempenho adequado a arquivos grandes dentro dos limites definidos.
- Testabilidade e logs sem conteúdo confidencial.
- Dependências com licenças compatíveis.

## 6. Critérios de aceite do MVP
- Importa arquivo válido e rejeita arquivo inválido com explicação.
- Processa arquivo de teste real em português através de um provedor configurado.
- Apresenta transcrição e, se suportado, timestamps e falantes.
- Produz resumo e relatório completo sem preencher lacunas com fatos inventados.
- Permite edição antes da exportação.
- Gera PDF e DOCX que abrem corretamente.
- Permite cancelar e descartar sessão.
- Não cria conta, backend próprio ou histórico permanente.
- Testes automatizados cobrem validações, transformação de dados e exportação.


## 6. Requisitos adicionais — desktop e captura de tela/janela

### RF-13 — Duas experiências
Disponibilizar aplicativo desktop instalável e extensão Chrome/Firefox. Windows será a primeira plataforma desktop-alvo. Compartilhar domínio e casos de uso sempre que possível. Tecnologia desktop permanece pendente de prova de conceito.

### RF-14 — Seleção de fonte visual
Permitir que o usuário escolha explicitamente tela inteira/monitor, janela específica de aplicativo ou aba do navegador quando suportada. A extensão também poderá ser usada diretamente na aba da audiência, quando compatível.

### RF-15 — Análise de conteúdo reproduzido externamente
Permitir acompanhar audiência ou gravação reproduzida fora do Ouve, inclusive em outro monitor, tela dividida ou reprodutor local. Não exigir upload/importação nem reprodução interna para esse modo. Capturar áudio associado quando disponível e autorizado; informar quando só imagem ou só áudio puder ser obtido.

### RF-16 — Captura privada
A fonte compartilhada é entregue apenas ao próprio Ouve para análise. Não é chamada, transmissão ou compartilhamento com outros participantes.

### RF-17 — Controles
Exigir seleção e autorização explícitas; mostrar indicador persistente; permitir pausar, retomar, trocar fonte e encerrar; explicar permissões e limitações; nunca capturar ocultamente nem contornar avisos do navegador/SO.

### Critérios técnicos de aceite
Validar separadamente captura de vídeo e áudio do sistema/aba/microfone em Chrome, Firefox e desktop Windows. Testar monitor único, múltiplos monitores, tela dividida e janela externa (incluindo VLC). Verificar sincronização A/V, consumo de CPU/memória, conteúdo protegido e janelas minimizadas. Não prometer captura universal.
