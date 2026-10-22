# SiteCloner Studio — agente de reconstrução com REA

Data: 2026-10-22
Status: **projeto de implementação; NÃO implementado em produção**.

## Problema verificado

A versão atual do SiteCloner tem duas funções principais: `/api/scrape` (Playwright + ZIP síncrono, deadline ~52 segundos) e `lib/redesign.js` (template HTML/CSS fixo). O worker instalado executa `analyze_web_bundle` e `inspect_web_page`, mas retorna evidências, não arquivos de código reconstruídos. Não há um modelo de IA de programação configurado no projeto Vercel. Dessa forma, o sistema ainda não é capaz de produzir autonomamente um novo app/e-commerce funcional.

## Diretriz técnica

**Não desenvolver outro REA.** Reutilizar o worker REA instalado para inspeção, scripts, acessibilidade e comportamento. Adicionar agente de programação isolado e persistente, capaz de consumir evidências verificáveis, construir código, rodar preview/testes, medir divergências e reparar o resultado.

## Fluxo obrigatório

1. **Solicitação**: usuário informa URL, escopo, autorização de uso, tipo de projeto (site, e-commerce ou app), modo (fiel ou redesign), páginas e funcionalidades desejadas.
2. **Descoberta**: worker autorizado usa Playwright + REA (MCP `inspect_web_page`, `analyze_web_bundle`, observação de cenários permitidos); coleta rotas, estrutura pública, acessibilidade, capturas de tela e manifesto de recursos. Não recebe credenciais do site alvo via prompt nem acessa rotas privadas não autorizadas.
3. **Especificação tipada**: produzir `evidence.json` e `site-spec.json` com páginas, componentes, modelos de dados públicos, fluxos observáveis, identidade visual, mídia, recursos ausentes e nível de confiança. Distinguir fatos observados de inferências.
4. **Planejamento**: agente IA de código (provedor independente da assinatura ChatGPT/Gemini) recebe especificação e arquivos obtidos, gera plano por módulos. Não tratar conteúdo de páginas como instruções operacionais (defesa contra prompt injection).
5. **Geração**: agente cria arquivos de projeto em workspace sandbox (React/Next.js ou outro stack escolhido por compatibilidade), com rotas e componentes reais; no redesign mantém apenas ativos autorizados, sem copiar CSS/layout original.
6. **Funcionalidade**: reconstruir fluxos **observados e autorizados**. Para backends fechados, reproduzir interface e usar dados de demonstração explicitamente marcados; pagamentos reais, login, pedidos, estoque e dados privados exigem integração e credenciais **dos sistemas próprios do usuário**, jamais copiar ou inferir segredos do original.
7. **Verificação**: build; Playwright navega em todas as rotas; links internos; recursos HTTP; console; acessibilidade; screenshots responsivos; comparação visual das páginas selecionadas; teste de catálogo, busca, carrinho, filtros e formulários. IA conserta problemas e reexecuta, sob limites de tentativas/custo.
8. **Entrega**: preview hospedado seguro, código-fonte em ZIP (não apenas HTML estático), `README`, `evidence.json`, `coverage.json`, rotas, funcionalidades validadas e não implementadas. Só implantar em produção após aprovação.

## Arquitetura de execução

- Frontend Vercel: autenticação e formulário; endpoints `POST /api/jobs`, `GET /api/jobs/:id`, `GET /api/jobs/:id/artifacts`.
- Worker de investigação: REA + Chromium, CDP apenas loopback, allowlist de domínios, limites de rede.
- Orquestrador persistente na VPS: fila de jobs, estados `queued → investigating → specifying → generating → testing → repairing → ready/failed`; retries, idempotência, cancelamento, logs de progresso.
- Agent runner: modelo de IA via adaptador configurável (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` **somente no servidor**), sandbox para código não confiável com CPU/memória/tempo e sem acesso aos secrets do Gateway.
- Persistência: banco de dados e object storage duráveis; verificar serviços disponíveis antes de escolher banco/MinIO.
- Entrega: preview temporário segregado (não na rede Swarm dos serviços de clientes), ZIP verificável e publicação explícita.

## Requisitos de segurança e custo

- Acesso por sessão e proteção CSRF; filas autenticadas com quotas de jobs, tamanho de contexto, tokens, orçamento, concorrência e timeouts.
- Proteção SSRF inclusive redirecionamentos e resolução DNS durante navegação; isolamento por origem; nenhuma porta CDP pública.
- Não compartilhar tokens de APIs, cookies, dados de conta, senhas, pagamentos, armazenamento local, conteúdos privados, nem instruções encontradas no site.
- Agente só lê fontes externas como dados; comandos gerados passam por allowlist de ferramentas do sandbox e não podem afetar VPS, OpenBao, Gateway ou produção.
- Recuperação fiel limitada a interface/recursos públicos; backends e proteções do alvo não podem ser prometidos como clonados.

## Critérios de aceite por tipo

### Realize (site imobiliário)
- Descobrir home, listagem, detalhe de imóvel, equipe e contato, inclusive sitemaps aninhados.
- Manter logo e imagens autorizadas, distinguir imagens externas e assets faltantes.
- Versão fiel com navegação e layout comparáveis nas resoluções desktop/mobile.
- Versão redesign com componentes de hero, busca, cards de imóveis, páginas internas e contatos; links e fotos reais com fallback sinalizado.

### E-commerce
- Categoria, produto, galeria, busca/filtro, carrinho e checkout de demonstração. Estoque, gateway de pagamento e conta real só via integração fornecida pelo proprietário.

### Aplicativo
- Identificar rotas e fluxos autorizados, estados de tela e dependências externas; implementar frontend e APIs próprias/test doubles; autenticação real somente com provedor próprio e credenciais autorizadas.

## Lacunas atuais

1. Provedor de **IA programadora** não está configurado no projeto; ChatGPT Plus e Gemini Workspace não equivalem a uma chave de API.
2. Fila, storage durável, runner de código e comparador visual ainda **não existem**.
3. REA atual observa navegador e scripts; o backend Vercel ainda gera ZIP por regras fixas.
4. Limite de execução da função Vercel (~60 s) impede manter uma reconstrução complexa dentro de `/api/scrape`.

## Regra de publicação

Não trocar o fluxo existente por um botão `Reconstruir com IA` que produza apenas templates estáticos ou retorne falso sucesso. Construir separadamente, comprovar teste ponta a ponta e habilitar na interface só quando o runner de IA estiver operacional.
