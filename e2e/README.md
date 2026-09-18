# Testes do visualizador PDF

`pdf-mobile.spec.ts` cria PDFs válidos em memória para cinco perfis: iPhone antigo e novo, Android antigo e novo, e PC. Os perfis móveis usam viewport, toque e mecanismo WebKit ou Chromium do Playwright. Nos perfis antigos, o teste remove `Promise.withResolvers` e `AbortSignal.any` antes da aplicação carregar. Cada cenário verifica o preview no painel, a pintura da última página, a visualização na assinatura, o posicionamento do carimbo e a ausência de `iframe`.

Para executar a suíte com os navegadores no Docker:

```sh
docker build -f Dockerfile.prod -t rubrica-web:pdf-mobile .
docker run -d --rm --name rubrica-pdf-e2e -p 127.0.0.1:18080:80 -e RUBRICA_DOMAIN=localhost rubrica-web:pdf-mobile
docker run --rm --network host --ipc=host -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.55.0-noble npm run test:e2e
docker stop rubrica-pdf-e2e
```

As chamadas de API usam respostas de teste e o Service Worker é bloqueado para permitir interceptá-las. A suíte não reproduz o sistema operacional nem a versão real do Safari ou Chrome dos aparelhos; faça uma conferência final em dispositivos físicos antes de publicar.
