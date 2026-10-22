# Worker REA isolado

**Não implantado**. Código inicial para acoplar Chromium e REA no mesmo namespace de rede.

- `worker/server.js` executa Chromium com CDP somente em 127.0.0.1:9222; inicia REA via MCP stdio e chama `analyze_web_bundle`.
- Não publicar porta CDP. O worker só deve ser acessível por um backend autenticado em rede privada ou reverse proxy TLS com autenticação adicional.
- Exigir `ALLOWED_HOSTS` para domínios expressamente autorizados. É proibido deixar a lista aberta; o worker nunca deve navegar a destinos internos.
- Definir `REA_WORKER_TOKEN` em gerenciador de secrets, não em Git e não no navegador.
- Necessita `chromium`, `rea` (rea-agents), `playwright-core` e `@modelcontextprotocol/sdk` na imagem.
- O worker atende `POST /analyze` com Bearer token e JSON `{"url":"https://dominio-autorizado.com"}`.
- Health: `GET /health`.
- Somente uma sessão por worker. Limitar concorrência no balanceador; usar cgroup CPU/RAM e prazo externo.
- **Pendente**: validar execução real em contêiner de teste, timeout de subprocessos, DNS rebinding, redirecionamentos, sanitização de evidências antes de produção. Não executar em sites não autorizados.
