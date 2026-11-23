# 18 — Padrão visual e de interface (redesign de 23/11/2026)

Registro permanente do padrão de interface do Ouve (desktop e versão web, que usam as mesmas telas; a extensão compartilha os tokens). Complementa o [docs/13](13-experiencia-e-telas.md), que guarda a visão original de telas.

## 1. Diagnóstico do design anterior
Auditoria feita no app desktop em execução (Electron, 1366×768 e 1280×720) e no código; a versão publicada no GitHub Pages era a mesma do commit `0c53901`, sem divergência.

| Problema | Onde | Efeito |
|---|---|---|
| Conteúdo com largura máxima fixa, deixando metade do monitor vazia | todas as páginas | aproveitamento ruim da tela |
| Rolagem da página inteira | Nova sessão, Provedores, Análise e relatório, Configurações, Ajuda | ações principais (Iniciar, Salvar) fora da tela |
| Relatório em uma coluna interminável de painéis | Análise e relatório | difícil achar decisões, tarefas, perguntas |
| Não havia lista de relatórios | — | quem faz 10–20 relatórios por dia perdia o anterior ao começar outro |
| Cartões altos e textos longos | Início, Importar | pouca informação por tela |
| Configurações e ajuda empilhadas | Configurações, Ajuda | página enorme, sem categorias |
| Formulário avançado de provedor no meio da página | Provedores | assustava quem só queria colar a chave |
| Menu com 8 itens fixos, incluindo “Sessão atual” mesmo sem sessão | menu | ruído para iniciantes |
| Paleta azul/violeta genérica, gradiente na marca | geral | aparência de template |

## 2. Conceito
**Calmo, compacto e confiável** — uma ferramenta de trabalho para longas jornadas (audiências, reuniões em sequência).

- **Cor de destaque única: verde-azulado** (`--accent`: `#0f766e` no claro, `#34b8a8` no escuro). Remete a escuta e serenidade e se distancia dos azuis genéricos. Vermelho fica reservado a gravação e ações destrutivas.
- **Neutros levemente quentes** (cinzas “pedra”), menos cansativos que os cinzas azulados.
- **Marca**: quadrado com o “O” que escuta (anel + ondas), sem gradiente, na cor de destaque do tema.
- **Tipografia do sistema** (Segoe UI Variable no Windows), 13 px de base, títulos 15 px, números tabulares; monoespaçada (Cascadia Mono/Consolas) para horários e modelos. Nenhuma fonte baixada.
- **Bordas finas, sombras só em elementos flutuantes** (menus, painel lateral, toast). Raio 6/8/12 px.

## 3. Estrutura
```
┌──────────┬───────────────────────────────────────────────┐
│ Marca    │ Título da página · subtítulo curto   [estado] [ações] │  ← cabeçalho 52 px (46 px em telas baixas)
│ Início   ├───────────────────────────────────────────────┤
│ Nova reunião │                                           │
│ Importar │      corpo da página = altura restante        │
│ (Sessão) │      só áreas internas rolam                  │
│ Relatórios│                                              │
│ SISTEMA  │                                               │
│ Provedores│                                              │
│ Config.  │                                               │
│ Ajuda    │                                               │
│ tema · recolher │                                        │
└──────────┴───────────────────────────────────────────────┘
```
- **Menu lateral** de 216 px, recolhível para 56 px (só ícones, com nome no `title` e `aria-label`); recolhe sozinho abaixo de 960 px de largura. A preferência fica nas configurações locais (`sidebarCollapsed`).
- **“Sessão atual”** só aparece quando há sessão, com ponto vermelho pulsante gravando, âmbar pausado ou indicador de processamento.
- **Cabeçalho único por página**: nome da seção, subtítulo de uma linha e, à direita, o **chip de estado global** (Gravando 00:12:31 / Processando arquivo / Gerando relatório) — clicável, visível em qualquer página.
- **Regra de rolagem**: `.page-body` ocupa a altura restante; listas, transcrições, tabelas e textos longos rolam dentro do próprio painel. Se a janela ficar pequena demais, o corpo rola (nunca corta conteúdo; não há `overflow: hidden` escondendo controles).

## 4. Páginas
| Página | Organização | Cabe em uma tela? |
|---|---|---|
| Início | Saudação no cabeçalho; dois blocos de ação (Nova reunião, Importar arquivo); “Relatórios recentes” (até 6, lista compacta); à direita: sessão atual, estado da IA (ou configuração rápida) e nota de privacidade | Sim, nas 4 resoluções (teste automático) |
| Nova reunião | Duas colunas: “De onde vem o áudio?” (opções com explicação, lista de telas/janelas com rolagem interna, microfone, teste de 5 s) e “Resumo” (nome, tipo de reunião, IA, modelo, idioma, opções avançadas recolhíveis, Iniciar). A aba do navegador não aparece como opção no desktop (só funciona pela extensão); na web aparece o seletor do navegador | Sim |
| Sessão atual (durante a reunião) | Barra de estado (gravação, tempo, nível, pausa/retomar, microfone, encerrar), marcadores, abas Transcrição / Participantes / Marcadores / Métricas com rolagem própria; coluna lateral com números, participantes, tempo por etapa e próximos passos | Sim (só a transcrição rola) |
| Importar arquivo | Área de seleção grande, formatos em etiquetas, limite real (desktop: configurado; web: 300 MB/2 h); à direita, resumo e **etapas com progresso real** (minutos extraídos, pedaços transcritos — sem porcentagens inventadas) e atalho para a transcrição | Sim |
| Relatórios | Tabela compacta: Nome, Data, Duração, Participantes, Tipo, Status (Sessão atual / Exportado (PDF, DOCX) / Não exportado), ações Abrir · Exportar (menu) · Excluir com confirmação. Pesquisa, período, ordenação por coluna e paginação (12 por página) | Sim; a tabela rola por dentro |
| Relatório (leitura e edição) | Navegação lateral: Resumo (título, tipo, objetivo, resumo, conclusão, contagem por seção, avisos do validador), Participantes, uma entrada por seção da análise com contagem, Transcrição, Métricas, Observações, Exportar (seções e opções) | Sim; cada seção rola por dentro |
| Provedores de IA | “Qual IA usar” (transcrição e análise) + “Cole sua chave”; abas Provedores configurados (tabela: nome, nuvem/computador, estado, modelo, uso, Testar/Configurar/Remover) e IA no seu computador. Configurar abre **painel lateral**: explicação, chave protegida, link oficial e passos, Salvar / Salvar e testar, configuração avançada recolhível (modelos, endpoint, serviços, cabeçalhos) | Sim na visão geral |
| Configurações | Categorias: Geral, Aparência, Áudio, Importação, Exportação, Privacidade, Atualizações (desktop), Sobre. Salvar no cabeçalho, só habilitado com alterações; “Desfazer” | Cada categoria em sua própria tela |
| Ajuda | Tópicos: Primeiros passos, Custos e dados, Chaves de IA, Glossário, Limitações | Cada tópico em sua própria tela |

## 5. Relatórios desta execução (D-083)
Os relatórios de sessões descartadas ficam **só na memória** até fechar o Ouve (nunca em disco, nunca o áudio). Pode ser desligado em Configurações → Privacidade (`keepReportsInSession`). O termo de uso foi atualizado para dizer isso (TERMS_VERSION 2, novo aceite único). Relatórios da lista podem ser abertos, editados e exportados; a transcrição deles é somente leitura.

## 6. Componentes (`apps/desktop/src/renderer/src/components.tsx`)
| Componente | Uso |
|---|---|
| `Page` | Cabeçalho compacto + corpo que ocupa a janela (`scroll` para textos longos) + chip de estado global |
| `Panel` | Cartão com título, ícone e ações; `flush` para tabelas/listas encostadas |
| `Tabs` | Abas horizontais ou verticais, navegação por setas, `role="tablist"` |
| `Drawer` | Painel lateral modal (Esc/clique fora fecham, foco no primeiro campo e devolvido ao sair) |
| `EmptyState` | Estado vazio com ícone, texto útil e ações |
| `StatusBadge` | Estado com **ícone + texto** (nunca só cor): ok, warn, danger, accent, neutral |
| `TranscriptView`, `SpeakersPanel`, `LevelMeter`, `Messages` | Preservados, restilizados |

Botões: padrão (32 px), `small` (28 px), `large` (40 px, largura total), `primary`, `danger`, `ghost`, `icon-only` (sempre com `aria-label`). Campos de 32 px. Ícones: traço 1,8 px em 24×24, próprios do pacote `@ouve/ui` (novos: search, sidebar, sort, eye, external, chevronDown/Left, edit, calendar, library, key, globe, arrowRight, palette, volume, archive).

## 7. Tokens (`packages/ui/src/tokens.css`)
`--bg`, `--sidebar`, `--surface`, `--surface-2/3`, `--border`, `--border-strong`, `--text`, `--muted`, `--faint`, `--accent`, `--accent-2`, `--on-accent`, `--accent-soft`, `--accent-line`, `--ok/--warn/--danger` (+ `-soft`), `--rec-*`, `--pause-*`, `--shadow`, `--shadow-sm`, `--radius-sm/--radius/--radius-lg`, `--font`, `--mono`. Tema claro, escuro e “seguir o sistema” (`prefers-color-scheme`), escolha persistida localmente.

## 8. Acessibilidade
Foco visível em todos os controles (contorno na cor de destaque), navegação por teclado nas abas, `aria-current` no menu, `aria-sort` nas colunas, `aria-live` no chip de estado, ícones decorativos ocultos e botões só de ícone com nome acessível, estados sempre com texto, confirmação antes de excluir/descartar, `prefers-reduced-motion` respeitado. Contraste do texto principal e secundário acima de 4,5:1 nos dois temas (texto “faint” usado só em rótulos auxiliares).

## 9. Responsividade
Referências testadas: 1280×720, 1366×768, 1440×900, 1920×1080. Abaixo de 800 px de altura, cabeçalho e espaçamentos encolhem; abaixo de 1240 px de largura, colunas laterais estreitam e colunas secundárias da tabela somem; abaixo de 960 px o menu vira só ícones; abaixo de 860 px as páginas passam a uma coluna e o corpo rola.

## 10. Testes
- `apps/desktop/e2e/layout.spec.ts`: em cada resolução de referência, abre todas as páginas vazias e com provedor + sessão + relatório (e no tema escuro) e falha se o corpo da página precisar de rolagem. Com `OUVE_SHOTS=<pasta>` salva capturas.
- `apps/desktop/e2e/app.spec.ts`: fluxos completos atualizados + biblioteca de relatórios (lista, pesquisa, abrir, excluir).
- Capturas de referência em `docs/img/padrao-visual/`.

## 11. Limitações conhecidas
- Arrastar e soltar arquivos não foi implementado: no desktop exigiria um canal IPC novo para receber o caminho do arquivo. A área de importação é de clique.
- A transcrição de relatórios guardados na lista é somente leitura (edição de trechos e falantes só na sessão atual).
- Métricas só aparecem para a sessão atual.
- A extensão recebeu os novos tokens (cores, marca), mas não a nova estrutura de navegação.
- O redesign não foi validado em Windows real com escala de tela de 125%/150% (P-040).
