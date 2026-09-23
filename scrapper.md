# Plano de reorganização do scraping

## Objetivo

Dividir o atual `scrapper-aulas` em dois workspaces npm internos:

- `unicamp-scrapper-lib`: biblioteca TypeScript para obter e interpretar páginas da Unicamp.
- `unicamp-scrapper-cli`: executável para listar e executar crawlers e páginas isoladas.

Um sincronizador externo poderá consumir a biblioteca diretamente para obter dados em memória e sincronizá-los com um backend. A biblioteca não depende de SDK, URL de backend, credenciais, da CLI ou de arquivos JSON intermediários.

## Modelo da biblioteca

Cada fonte é modelada como uma página. A API da biblioteca tem três camadas:

1. `fetch*` obtém exatamente um HTML.
2. `parse*` transforma exatamente um HTML em um objeto serializável daquela página.
3. `Crawler` parte de uma página raiz, carrega as filhas e monta um agregado.

Exemplo:

```ts
fetchCadernoDeHorarioInstituto({
  year,
  semester,
  instituteCode,
}): Promise<string>

parseCadernoDeHorarioInstituto(
  html: string,
  input: CadernoDeHorarioInstitutoInput,
): CadernoDeHorarioInstitutoPage

crawlCadernoDeHorario(
  input: CadernoDeHorarioInput,
  context: ScrapingContext,
): Promise<ScrapeResult<CadernoDeHorario>>
```

As entradas de fetch são objetos tipados, não argumentos posicionais, para que novos identificadores possam ser adicionados sem quebrar assinaturas.

## API pública

```ts
interface PageFetcher {
  fetch(url: string, options?: FetchOptions): Promise<string>;
}

interface ScrapingContext {
  fetcher: PageFetcher;
  concurrency: number;
  load<PageInput, PageData>(
    page: PageAdapter<PageInput, PageData>,
    input: PageInput,
  ): Promise<PageResult<PageData>>;
}

interface PageAdapter<Input, Data> {
  id: string;
  fetch(input: Input, context: ScrapingContext): Promise<string>;
  parse(html: string, input: Input): Data;
}

interface ScrapeResult<Data> {
  data: Data;
  issues: ScrapeIssue[];
  pages: PageMetadata[];
}
```

Parsers não fazem I/O, não retornam objetos Cheerio e incluem apenas dados da página e referências tipadas para filhas. Crawlers controlam concorrência, carregam referências e acumulam falhas.

## Convenção de campos retornados

Os dados serializados pela biblioteca e pela CLI usam `camelCase` em inglês. Por
exemplo, o caderno de horários retorna `year`, `semester`, `institutes`,
`courses`, `classes`, `weekday`, `time.start`, `time.end` e `room`; o
calendário retorna `startDate`, `endDate`, `category` e `description`; e o
cardápio retorna `menu`, `meals`, `meal`, `label`, `vegan`, `items`,
`observations` e `serviceNotes`.

Textos, seletores CSS, URLs e valores extraídos do site de origem permanecem
inalterados quando fazem parte do contrato externo da Unicamp.

`PageFetcher` é injetado. A biblioteca não define política de cache: a CLI pode fornecer SQLite com retry/backoff; um sincronizador externo pode usar rede direta, cache persistente ou revalidação conforme sua execução.

## Páginas e crawlers

### Caderno de horários

- `fetch/parseCadernoDeHorarioPagina`: índice de um ano e semestre.
- `fetch/parseCadernoDeHorarioInstituto`: dados e referências de disciplinas de um instituto.
- `fetch/parseCadernoDeHorarioDisciplina`: turmas, docentes, reservas, aulas, horários e salas.
- `CadernoDeHorarioCrawler`: agrega índice, institutos e disciplinas.

### Catálogos e currículos

- `fetch/parseCatalogosIndice`: anos disponíveis.
- `fetch/parseCatalogoProgramas`: programas de um catálogo.
- `fetch/parseCatalogoProgramasHistoricos`: programas dos catálogos de 1998 em diante, normalizando os layouts clássico, intermediário e moderno.
- `fetch/parseCatalogoDisciplinasIndice`: prefixos de disciplinas.
- `fetch/parseCatalogoDisciplinasPrefixo`: disciplinas de um prefixo.
- `fetch/parseCursoCurriculo`: blocos, modalidades, eletivas e pré-requisitos.
- `fetch/parseCursoMembros`: unidade responsável.
- `fetch/parseCursoInformacoes`: turno, limite de créditos e informações de programa ou especialização.
- `fetch/parseCursoSugestao`: sugestões, semestres, créditos e disciplinas.
- `CatalogoDisciplinasCrawler`, `CatalogoCurriculosCrawler`, `CatalogoInformacoesCrawler` e `SugestaoCurriculoCrawler` agregam as respectivas árvores.

### Fontes institucionais

- `fetch/parseCalendarioGraduacaoPagina` e `CalendarioCrawler` interpretam calendário, períodos, `rowspan` e `colspan`.
- `fetch/parseCardapioPortal`, `fetch/parseCardapioDia` e `CardapioCrawler` descobrem o iframe e extraem refeições.
- Coletores DAC legados serão reexpressos como páginas especializadas e reutilizarão páginas de catálogo quando compartilharem fonte e formato.

Todos os adapters de página serão públicos e executáveis isoladamente pela CLI.

## CLI

O pacote `unicamp-scrapper-cli` publica o binário `unicamp-scrapper`.

```bash
unicamp-scrapper list
unicamp-scrapper caderno-horarios --year 2026 --semester 1
unicamp-scrapper calendario --year 2026
unicamp-scrapper cardapio --date 2026-08-11
unicamp-scrapper catalogos-programas --first-year 1998 --last-year 2020
unicamp-scrapper catalogo-curriculos --first-year 2021 --last-year 2026
unicamp-scrapper catalogo-informacoes --first-year 2021 --last-year 2026
unicamp-scrapper curso-curriculo --program-code 34 --name "Ciência" --url <url>
```

Os comandos de crawler e de página usam opções comuns:

- `--output <arquivo>` grava o JSON no arquivo indicado.
- `--cache <arquivo>` define o SQLite local, cujo padrão é `rawhtml.db`.
- `--refresh` ignora leituras do cache e substitui as páginas baixadas.
- `--concurrency <n>` limita carregamentos simultâneos.
- `--fetch-concurrency <n>` limita requisições HTTP simultâneas entre todos os crawlers.
- `--request-interval <ms>` define o intervalo mínimo entre inícios de requisições.

Sem `--output`, a CLI emite JSON no `stdout` e escreve avisos no `stderr`. Todos os comandos retornam o envelope nativo `ScrapeResult`, com `data`, `issues` e `pages`.

### Logs e OpenObserve

Os logs são emitidos pelo Pino. O envio remoto é opcional: sem
`OPENOBSERVE_URL`, nenhum request é feito. Quando configurado, use
`OPENOBSERVE_AUTH` ou `OPENOBSERVE_USER` e `OPENOBSERVE_PASSWORD`; o stream
pode ser alterado com `OPENOBSERVE_STREAM` (por padrão,
`unicamp-scrapper-logs`). `LOG_LEVEL` controla o nível, com compatibilidade
para `UNICAMP_SCRAPPER_LOG_LEVEL`.

## Falhas e integração

Uma falha de página filha gera `ScrapeIssue` com adapter, URL, entrada, causa e timestamp. O crawler registra a falha e continua as demais filhas, retornando dados parciais e issues.

A CLI não serializa formatos históricos de outros sistemas. Um sincronizador externo recebe `result.data` diretamente, projeta os modelos de fonte em seus próprios comandos e controla a sincronização com o backend.

## Validação

- Fixtures por função `parse*`, validando um HTML para um objeto de página.
- Testes de fetchers com `PageFetcher` falso e validação de URLs.
- Testes de crawlers para árvore completa, concorrência e falha parcial.
- Teste de integração do agregado de caderno com a projeção do sincronizador externo, sem JSON intermediário.
- Build estrito, testes e formatação nos dois workspaces.

## Decisões registradas

- O pacote se chamará `unicamp-scrapper-lib`.
- O pacote será interno ao monorepo, sem publicação npm inicial.
- O pacote da CLI se chamará `unicamp-scrapper-cli` e o binário será `unicamp-scrapper`.
- A CLI emite o formato nativo da biblioteca; a compatibilidade com importadores legados não faz parte dela.
- Todos os coletores existentes, incluindo DAC e caderno de horários, serão migrados.
- Implementações Python serão removidas após a cobertura equivalente em TypeScript; dados gerados e cache serão preservados.
