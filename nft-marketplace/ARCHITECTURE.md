# Arquitetura e decisoes

## Camadas

- `src/domain/contracts.ts`: contratos Zod e tipos compartilhados entre transporte, mocks e interface.
- `src/lib/http`: instancia Axios, token de autenticacao e timeout de 5 segundos.
- `src/features`: queries, mutations e telas organizadas por dominio.
- `src/mocks`: handlers REST do MSW, store persistido e binding Socket.IO.
- `src/lib/realtime`: cliente Socket.IO, ordenacao por versao, atualizacao de cache e reconciliacao.

## Sessao e dados privados

O token e restaurado de `localStorage` e validado por `GET /auth/session`. Rotas de carrinho, checkout, pedidos, perfil e carteiras usam guard do TanStack Router. Queries privadas sao chaveadas pelo `userId`; logout e erros 401 removem token, cache privado e subscriptions do Socket.IO. Os mocks mantem o digest da senha em memoria, sem persistir a senha em claro.

## Cache e mutations

O QueryClient nao faz retry automatico e nao refaz busca ao focar a janela; isso torna cenarios de erro deterministas. A sessao fica fresca por 30 segundos. Cada mutation invalida ou atualiza a query afetada. Favoritos e carrinho usam atualizacao otimista com cancelamento da query anterior e rollback se a chamada falhar.

Catalogo e filtros compoem a query string validada pelo TanStack Router. Mudancas de filtro reiniciam a pagina. Os schemas Zod validam a fronteira entre REST e aplicacao, e o cache usa os parametros da consulta na query key.

## Carrinho, cotacao e pedidos

O estado persistido do mock e separado por usuario. A cotacao e a fonte de verdade para subtotal, desconto, taxa e total. ETH e representado como string decimal e calculado com `decimal.js`.

Pedidos exigem `Idempotency-Key`. A mesma chave com o mesmo conteudo retorna o mesmo pedido; com conteudo diferente resulta em conflito. O recibo e um snapshot do pedido, portanto alteracoes posteriores no catalogo nao mudam seus valores. Em confirmacao, somente os itens/quantidades comprados sao removidos do carrinho.

## REST e Socket.IO

O MSW intercepta REST no nivel de rede. Para realtime, `socket.io-client` conecta-se por WebSocket e `@mswjs/socket.io-binding` emite `nft.updated` e `order.updated`. Cada evento possui identidade e versao. Eventos duplicados, antigos e eventos de outro usuario sao ignorados. Na reconexao, catalogo, carrinho, cotacao e pedidos ativos sao invalidados e consultados novamente no REST.

## Acessibilidade e responsividade

As telas usam labels associados, foco visivel, feedback textual e componentes com semantica de botao/formulario. Os testes E2E exercitam desktop (1440 px), tablet (768 px) e mobile (390 px), incluindo verificacao de overflow e snapshots visuais dos fluxos principais.

## Limitacoes e desvios assumidos

- Blockchain, extensoes de carteira, pagamentos e explorador de transacoes sao simulados, conforme o escopo do desafio.
- O Socket.IO mock e destinado ao navegador/MSW; um backend real deve fornecer autenticacao do handshake, autorizacao de canais e retencao/replay de eventos.
- Os relatórios Lighthouse sao gerados por perfil em `lighthouse-reports/`. As metricas dependem da versao local do Chromium e do ambiente de execucao; o relatorio versionado registra essas condicoes junto aos artefatos. Nesta medicao, os SVGs rasterizados e a estabilizacao tardia do detalhe impedem atingir as metas de Performance e CLS.
