# Executando o agente de IA SiteCloner (piloto seguro)

## Situação
Implementação criada em `feat/ai-reconstruction-orchestrator`, protegida por feature detection. O SiteCloner em produção continua usando a captura atual; o novo botão aparece somente se o worker e o modelo estiverem operacionais. **Não significa que o agente esteja ativo**.

## O que já existe no código
- `api/build.js`: proxy Vercel autenticado pela sessão atual; `GET /api/build` consulta `/health` e não libera o botão antes do modelo estar configurado; `POST /api/build` cria um trabalho; `GET /api/build?id=...` consulta status e `&download=1` faz download.
- `worker/builder-server.js`: worker persistente single-process, uma geração de cada vez, fila limitada, diretório de dados e status idempotentes; arquivos 0600.
- `lib/ai-builder/spec.js`: exige resultados REA de `inspect_web_page` e `analyze_web_bundle` e separa evidências de instruções do usuário.
- `lib/ai-builder/model.js`: adaptador de API de modelo **compatível com Chat Completions**, com endpoint HTTPS e resposta JSON, limite de tokens e timeout.
- `lib/ai-builder/project.js`: restringe caminhos de arquivos gerados, fixa `package.json` e `src/main.jsx`, produz ZIP auditável.
- `lib/ai-builder/compile.js`: compila React com esbuild, sem execução de scripts fornecidos pelo modelo, e inclui `preview/` compilado.
- `worker/builder.Dockerfile`: imagem sem root, dados persistidos em volume.

## Credenciais e variáveis necessárias
### Worker (VPS; variáveis no container)
```env
HOST=0.0.0.0
PORT=8791
BUILDER_DATA_DIR=/data/sitecloner-builder
BUILDER_WORKER_TOKEN_FILE=/run/secrets/builder_worker_token
REA_WORKER_URL=https://mcp.figueiramarketing.com.br/sitecloner-rea
REA_WORKER_TOKEN_FILE=/run/secrets/rea_worker_token
BUILDER_MODEL_ENDPOINT=https://PROVEDOR/v1/chat/completions
BUILDER_MODEL_NAME=MODELO_CONTRATADO
BUILDER_MODEL_API_KEY_FILE=/run/secrets/builder_model_api_key
```
A URL do modelo é ilustrativa. **Não existe provedor configurado**. ChatGPT Plus/Gemini Workspace não equivalem automaticamente a uma API key. Não armazenar chaves no repositório nem no frontend.

### Vercel (apenas server-side e criptografadas)
```env
BUILDER_WORKER_URL=https://ENDPOINT-HTTPS-DO-BUILDER/CAMINHO
BUILDER_WORKER_TOKEN=TOKEN-EXCLUSIVO
```
Não adicionar estas variáveis enquanto o endpoint HTTPS autenticado não estiver provisionado.

## Implantação segura
1. Escolher provedor de IA programadora e modelo, criar credencial de API com limite de gasto; testar com dados fictícios.
2. Criar Docker Secrets exclusivos `builder_worker_token` e `builder_model_api_key`, reaproveitar REA token apenas de forma autorizada. Não copiar segredos em comandos ou logs.
3. Montar volume `/data` exclusivo, uma réplica Swarm, limites recomendados inicialmente 768 MiB, 1 CPU; jamais montar docker.sock e não conectar à rede OpenBao/Gateway.
4. Expor apenas a porta HTTP **interna** 8791 via Traefik com HTTPS, rota dedicada e bearer token, sem publicar porta host.
5. Executar `GET /health`: esperado `ready:true` apenas se REA + modelo + tokens estão presentes. Em modelo ausente, retorna `ready:false` e `POST /jobs` falha com 503.
6. Configurar duas variáveis criptografadas na Vercel, criar deployment preview e testar login, start/status/download. Só depois promover.
7. Validar segurança, privacidade, URLs de entrada, saída React, recursos e revisão visual em desktop e mobile no site da Realize antes de liberar para uso comercial.

## Limites desta primeira implementação
- **Agente de código existe**, mas não está ligado a modelo real nem implantado como serviço persistente.
- A geração atual é de **frontend React** com dados de demonstração e ativos públicos identificados pelo REA; não descobre segredos nem copia backend fechado.
- Há validação de contrato, compilação/bundling, ZIP e até dois reparos automáticos de erros de compilação; **ainda não há** teste Playwright do código reconstruído, comparação de screenshots, revisão visual iterativa, preview hospedado ou sandbox completo com execução do aplicativo.
- Um e-commerce pode ter interface de catálogo e carrinho simulados; pagamentos, pedidos e estoque reais exigem integração autorizada do dono.
- O worker exige resultados positivos nas **duas** ferramentas REA; executa inspeções adicionais em até duas rotas internas descobertas quando disponíveis. Não produz falso sucesso.
- A fila usa filesystem único; não adicionar réplicas sem migrar para storage compartilhado/banco.

## Testes de aceitação próximos
- Mock de IA: todas as fases da fila, JSON, compilação, ZIP de React, leitura do artefato; sem rede nem custos.
- REA Realize: home, detalhes, listagens, imagens e estrutura de navegação; verificar cobertura de URLs.
- Modelo real: código gerado, abrir preview, interagir com busca e links; reparar divergências até limite de orçamento.
