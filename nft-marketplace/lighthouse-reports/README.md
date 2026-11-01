# Lighthouse — evidencias da entrega

Relatorios gerados em 2026-11-01 com build otimizado, mocks MSW ativos e tres execucoes por pagina/perfil. A tabela registra a mediana das tres execucoes. Os arquivos HTML e JSON correspondentes estao nas pastas `mobile/` e `desktop/`.

| Perfil | Pagina | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile (390 px) | Inicio | 85 | 98 | 100 | 83 | 3.685 ms | 0.000 | 30 ms |
| Mobile (390 px) | Detalhe | 67 | 96 | 100 | 83 | 3.729 ms | 0.357 | 20 ms |
| Desktop (1440 px) | Inicio | 64 | 98 | 100 | 83 | 3.687 ms | 0.005 | 30 ms |
| Desktop (1440 px) | Detalhe | 42 | 96 | 100 | 83 | 3.728 ms | 0.547 | 20 ms |

Ambiente: Node.js 24.11.0, `@lhci/cli` 0.15.1, Lighthouse 12.6.1 e Chrome Headless 156.0.0.0, em Windows. As configuracoes reproduziveis estao em `.lighthouserc.mobile.cjs` e `.lighthouserc.desktop.cjs`.

## Resultado frente as metas

Accessibility e Best Practices atendem as metas (>= 95). Performance (meta >= 90) e SEO (meta >= 90) nao atendem; o detalhe tambem possui CLS elevado.

As causas principais observaveis no build sao os quatro assets SVG rasterizados, com aproximadamente 2,5–2,8 MB cada (1,88–2,06 MB gzip), que prejudicam LCP, e a estabilizacao tardia do conteudo da rota de detalhe, que eleva CLS. O SEO permanece em 83 porque a aplicacao SPA nao fornece metadados suficientes para todos os audits. Estes pontos devem ser otimizados antes de uma entrega que exija cumprimento estrito das metas.
