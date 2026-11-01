# Kurio — NFT Marketplace

Marketplace de NFTs feito com React e TypeScript. A aplicacao e inteiramente demonstravel sem backend: as APIs REST sao interceptadas pelo MSW e os eventos de tempo real usam `socket.io-client` com `@mswjs/socket.io-binding`.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Chromium instalado pelo Playwright (`npx playwright install chromium`)

Nao ha variaveis de ambiente nem servicos privados necessarios para executar a versao de demonstracao.

## Executar

```bash
npm ci
npm run dev
```

Abra a URL exibida pelo Vite (normalmente `http://localhost:5173`). O service worker do MSW e iniciado antes da interface; todas as requisicoes para `/api` sao atendidas localmente.

Para validar o build publicado localmente:

```bash
npm run build
npm run preview
```

## Credenciais de demonstracao

| Usuario | E-mail | Senha |
| --- | --- | --- |
| Ada Lovelace | `ada@example.test` | `demo-password` |
| Alan Turing | `alan@example.test` | `demo-password` |

Tambem e possivel criar uma conta pela tela de cadastro. Senhas nao sao persistidas em texto puro pelo mock; apenas o digest e mantido em memoria durante a sessao do service worker.

## Mocks, persistencia e cenarios

O estado do usuario (perfil, carteiras, favoritos, carrinho e pedidos) e persistido em `localStorage`, portanto sobrevive a refresh. Para retornar integralmente ao estado inicial, no Console do navegador execute e recarregue a pagina:

```js
localStorage.removeItem('nft-marketplace.mock-state')
localStorage.removeItem('nft-marketplace.auth-token')
location.reload()
```

Os cenarios reproduziveis do MSW sao `default`, `empty-catalog`, `transient-error`, `session-expired`, `invalid-coupon`, `price-changed`, `payment-declined` e `order-timeout`.

Em desenvolvimento, selecione um cenario pelo Console (o endpoint de controle so aceita esse cabecalho):

```js
await fetch('/api/test/scenario', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-E2E-Control': 'playwright' },
  body: JSON.stringify({ scenario: 'price-changed' }),
})
```

Recarregue a pagina apos trocar de cenario para reexecutar o fluxo desde o inicio. Exemplos de reproducao:

- `transient-error`: abra o catalogo e use **Tentar novamente**;
- `invalid-coupon`: adicione um NFT, entre no carrinho e aplique qualquer cupom diferente de `WELCOME10`;
- `price-changed`: adicione um NFT, entre no checkout e tente confirmar com a cotacao anterior;
- `payment-declined`: conclua o checkout para receber uma recusa simulada;
- `order-timeout`: conclua o checkout, recarregue e retome o mesmo pedido (a chave de idempotencia recupera a tentativa);
- `session-expired`: acesse uma rota privada e observe o redirecionamento para login.

O cupom valido e `WELCOME10` (10% de desconto).

## Comandos

```bash
npm run dev                 # desenvolvimento com MSW
npm run build               # tipos + build de producao
npm run preview             # serve o build de producao
npm run lint                # ESLint
npm test                    # testes unitarios/integracao (Vitest)
npm run test:e2e            # Playwright + MSW, Chromium e snapshots
npm run test:e2e:report     # abre o relatorio HTML do Playwright
npm run audit:mobile        # Lighthouse: 3 execucoes, perfil mobile
npm run audit:desktop       # Lighthouse: 3 execucoes, perfil desktop
```

Os testes E2E produzem `playwright-report/` e traces em `test-results/` quando ha falha. As baselines visuais de catalogo, detalhe e carrinho estao versionadas em `e2e/responsive.spec.ts-snapshots/`.

Os relatórios Lighthouse gerados nesta entrega, suas medianas e o ambiente de medicao estao em [`lighthouse-reports/README.md`](lighthouse-reports/README.md).

## Contratos REST e tempo real

Os schemas de request/response e dos eventos estao centralizados em [`src/domain/contracts.ts`](src/domain/contracts.ts). A tabela abaixo resume a superficie REST mockada.

| Recurso | Operacoes |
| --- | --- |
| Sessao | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout`, `PUT /auth/password` |
| Catalogo | `GET /nfts`, `GET /nfts/:nftId` |
| Favoritos | `GET/POST /favorites`, `DELETE /favorites/:nftId` |
| Carrinho/cotacao | `GET /cart`, `PUT /cart/items`, `POST /quotes` |
| Perfil | `GET/PUT /profile` |
| Carteiras | `GET/POST /wallets`, `PATCH/DELETE /wallets/:walletId`, `PUT /wallets/:walletId/primary` |
| Pedidos | `POST /orders` com cabecalho `Idempotency-Key`, `GET /orders/:orderId` |

`GET /nfts` recebe `search`, `collection`, `minPrice`, `maxPrice`, `network`, `sort`, `page` e `pageSize`; o estado equivalente tambem fica na URL. Valores em ETH trafegam como strings decimais e os calculos usam `decimal.js`.

Erros seguem `{ code, message }`, incluindo validacao (422), autenticacao/sessao (401), conflito (409), pagamento recusado (402), nao encontrado (404) e falha transitoria (503).

O transporte realtime usa Socket.IO sobre WebSocket em `/socket.io` e processa:

- `nft.updated`: `{ id, version, nft }`, atualiza catalogo, detalhe, carrinho e cotacao;
- `order.updated`: `{ id, userId, version, order }`, atualiza o pedido apenas do usuario dono.

Versoes impedem reaplicacao de eventos duplicados ou antigos. Ao reconectar, as queries ativas de catalogo, carrinho, cotacao e pedido sao invalidadas e reconciliadas via REST. A binding Socket.IO do MSW funciona no navegador para a demonstracao; nao representa um servidor Socket.IO de producao.

## Arquitetura e decisoes

Veja [`ARCHITECTURE.md`](ARCHITECTURE.md) para politica de cache e sessao, isolamento por usuario, sincronizacao REST/Socket.IO, limitacoes conhecidas e desvios de UX.

## Deploy

**Aplicacao publicada:** [https://nft-plataform-maketplace.vercel.app/](https://nft-plataform-maketplace.vercel.app/?sort=featured&page=1)

O projeto contem [`vercel.json`](vercel.json) com rewrite para `index.html`, permitindo acesso direto e refresh nas rotas do TanStack Router. Publique o resultado deste mesmo commit; como os mocks iniciam no navegador, nao e necessario configurar backend no provedor.
