# Integração REA — SiteCloner Studio

## Estado

Integração de código iniciada em branch isolada. **Não está ativada em produção**.

- SiteCloner atual: Vercel Serverless; `api/scrape.js` usa Playwright / Chromium no ambiente da função.
- REA atual: serviço privado na VPS Figueira, acessível pelo Figueira Gateway.
- Ferramentas reais verificadas no REA: `inspect_web_page` e `analyze_web_bundle` exigem `cdp_endpoint` **loopback** e `target_id` selecionado. Não aceitam somente uma URL ou ZIP.
- `analyze_javascript_application` exige `input_path` no filesystem local do REA, não um ZIP remoto.

## O que esta branch entrega

`lib/rea-bridge.js` é um adaptador MCP **server-side**, com validação de origem e CDP, credenciais via variáveis de ambiente e allowlist de ferramentas. Ele não expõe um proxy MCP público; não modifica o Gateway, OAuth proxy, redes ou secrets. Não é integrado à captura Vercel até haver executor CDP co-localizado.

## Bloqueio arquitetural real

O navegador Chromium iniciado dentro da função Vercel não fica acessível em loopback da VPS. Passar o endereço da Vercel ao REA não funcionará (e contraria a validação de CDP loopback da ferramenta).

## Implementação para completar antes de produção

1. Implantar um **worker de captura isolado** na VPS (ou junto do REA), com Chromium, Playwright e CDP escutando **apenas em loopback**, sem abrir portas públicas.
2. Permitir que o worker receba trabalhos autenticados do backend, com checagem SSRF e política de autorização. Nunca publicar CDP aberto na internet.
3. Após abrir a página, obter o `target_id` exato, executar REA `inspect_web_page` e `analyze_web_bundle` no mesmo host, aplicar limites e sanitizar resultados.
4. Unir evidências REA (rotas, chunks, recursos, endpoints potenciais) ao manifesto ZIP. Não incluir cookies, tokens nem dados privados.
5. Consertar coleta de `url(...)` de CSS, `srcset`, fontes, rotas e links reais antes de declarar fidelidade visual.
6. Testar em domínio autorizado com captura, análise, ZIP, prévia e navegação ponta a ponta; implantar só após testes.

## Variáveis servidor

- `REA_MCP_URL`: URL do MCP autenticado, via HTTPS ou HTTP loopback.
- `REA_MCP_TOKEN`: token secreto do serviço, somente no servidor.

**Não configure `REA_MCP_URL` no navegador, não inclua token em frontend e não declare integração operacional sem worker validado.**
