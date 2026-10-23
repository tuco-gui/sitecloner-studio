# Roteamento gratuito do SiteCloner no 9Router Figueira

## Estado real
- O código de reconstrução suporta o preset `BUILDER_MODEL_PROVIDER=9router`.
- Endereço HTTPS conhecido: `https://9router-nbob.srv1266039.hstgr.cloud/v1/chat/completions`.
- Combo a **criar e comprovar** no painel do 9Router: `FIGUEIRA-SITECLONER-FREE`.
- O combo **não foi criado** por esta alteração, pois não há acesso administrativo ao 9Router disponível pelas conexões institucionais atuais.
- A chave de API do 9Router **não** foi importada nem copiada do computador do usuário.
- O sistema permanece fechado: sem chave ou sem modelo listado no `GET /v1/models` do 9Router, o worker responde `ready:false`, e o botão Reconstruir com IA fica oculto.

## Configuração administrativa no 9Router (instância existente)

1. Entrar no painel próprio: `https://9router-nbob.srv1266039.hstgr.cloud`.
2. Em **Providers**, confirmar os modelos realmente gratuitos e ativos naquele momento, suas cotas e termos. Modelos `OpenCode Free` podem mudar ou estar limitados ao cliente oficial; não contornar verificações do provedor.
3. Em **Combos → Create New**, usar o nome exato `FIGUEIRA-SITECLONER-FREE`.
4. Escolher a estratégia **Fallback**. Colocar somente modelos com custo efetivo zero para essa conta. Não misturar modelos pagos, créditos temporários cobrados posteriormente ou rotas que cobrem por token. **Não ativar fallback automático para modelos pagos.**
5. Salvar e conferir o combo em `GET /v1/models` usando a chave autorizada do 9Router. Testar uma chamada a `POST /v1/chat/completions` com `model: "FIGUEIRA-SITECLONER-FREE"` e uma resposta JSON válida, inclusive limite de saída e tempo.
6. Se o painel suportar chave de API exclusiva e limites por origem/rota, emitir uma credencial **somente do SiteCloner** e guardar em Docker Secret/OpenBao. Caso contrário, não compartilhar uma chave administrativa irrestrita.
7. Verificar que o provedor cumpre os termos de automação e as cotas disponíveis; se não, mantenha o modelo desativado.

## Configuração no worker isolado (VPS do builder)

```env
BUILDER_MODEL_PROVIDER=9router
# O preset fornece o endpoint HTTPS e nome FIGUEIRA-SITECLONER-FREE.
# BUILDER_MODEL_ENDPOINT=... pode sobrescrever o endereço somente se necessário.
# BUILDER_MODEL_NAME=... pode sobrescrever o nome do combo.
BUILDER_MODEL_API_KEY_FILE=/run/secrets/builder_model_api_key
```

O token do 9Router não vai para o navegador ou variáveis públicas da Vercel. O worker usa o endpoint do servidor e valida a existência do combo antes de aceitar jobs; a checagem é cacheada por 30 segundos.

## Ollama e OpenCode

- **Ollama** é um serviço de inferência e tem API `/v1/chat/completions`, mas modelos locais precisam de RAM/CPU/GPU e contexto suficiente para código de site/app. Não instalar diretamente na VPS principal que já roda os serviços institucionais sem medir recursos e isolar limites.
  O builder aceita `BUILDER_MODEL_PROVIDER=ollama` com `BUILDER_MODEL_NAME=<modelo instalado>`. A URL padrão é `http://127.0.0.1:11434/v1/chat/completions` (somente se Ollama estiver no mesmo namespace de rede do worker). Endereços HTTP remotos são rejeitados; use HTTPS autenticado para Ollama remoto. O worker verifica `GET /v1/models` antes de aceitar trabalhos.
- **OpenCode** é um agente capaz de ler/escrever arquivos e executar comandos. Pode utilizar 9Router ou Ollama, e em uma segunda etapa pode substituir o gerador JSON simples por um agente que revisa o projeto em sessões. Qualquer execução precisa ocorrer em sandbox restrita, sem `docker.sock`, OpenBao ou rede de clientes.
- O SiteCloner atual pode consumir o **endpoint de IA do 9Router diretamente**. Não é preciso instalar OpenCode para a primeira geração React.
- O provedor gratuito pode falhar, limitar tokens ou deixar de existir. Isso não é garantia de clonagem gratuita e ilimitada.

## Critérios de aceite

- [ ] Combo dedicado presente na instalação **real** e confirmado gratuito.
- [ ] Chave exclusiva protegida no worker.
- [ ] `GET /health` no builder retorna `ready:true` somente com 9Router acessível e combo listado.
- [ ] Reconstrução de uma página simples com React compilado e ZIP válido.
- [ ] Reconstrução autorizada do site Realize: home, lista, detalhe, navegação, imagens e logos; inspeção visual desktop/mobile.
- [ ] Acompanhar cotas, número de tentativas, limites de custo e erros de JSON.
