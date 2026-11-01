# Lighthouse — evidências da entrega

Relatórios gerados em 2026-11-01 com build otimizado, mocks MSW ativos e três execuções por página/perfil. A tabela registra a mediana das três execuções. Os arquivos HTML e JSON correspondentes estão nas pastas `mobile/` e `desktop/`.

| Perfil | Página | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile (390 px) | Início | 84 | 98 | 100 | 92 | 3.685 ms | 0.000 | 28 ms |
| Mobile (390 px) | Detalhe | 84 | 96 | 100 | 92 | 3.681 ms | 0.000 | 18 ms |
| Desktop (1440 px) | Início | 60 | 98 | 100 | 92 | 3.928 ms | 0.005 | 28 ms |
| Desktop (1440 px) | Detalhe | 64 | 96 | 100 | 92 | 3.685 ms | 0.033 | 19 ms |

Ambiente: Node.js 24.11.0, `@lhci/cli` 0.15.1, Lighthouse 12.6.1 e Chrome Headless 156.0.0.0, em Windows. As configurações reproduzíveis estão em `.lighthouserc.mobile.cjs` e `.lighthouserc.desktop.cjs`.

## Resultado frente às metas

Accessibility, Best Practices e SEO atendem às metas. Performance ainda fica abaixo da meta de 90 nos quatro cenários, embora o CLS do detalhe tenha sido corrigido.

Os assets de NFT foram convertidos de SVGs rasterizados de aproximadamente 2,5–2,8 MB para WebP de 6–8 KB. Também foram definidos tamanhos intrínsecos, carregamento prioritário para a imagem principal, lazy loading para imagens secundárias e um skeleton que preserva o espaço da tela de detalhe. A maior oportunidade restante para Performance é reduzir o custo de inicialização JavaScript e o LCP de aproximadamente 3,7–3,9 s.
