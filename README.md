# SiteCloner Studio v2.0 — Clone & Scraper Imobiliário (Botucatu - SP)

## Estrutura de Pastas
- `index.html`: Aplicativo web completo (Clone Ativo, Redesign com IA/Paleta Manual, Galeria de 10 fotos por imóvel e Deploy GitHub).
- `scraper.py`: Script Python que baixa o logotipo oficial e 10 fotos para cada um dos 20 imóveis (10 venda + 10 locação).
- `dados_extraidos.json`: Base de dados estruturada dos imóveis raspados.
- `assets/logo/`: Logotipo oficial extraído.
- `imoveis/venda/imovel_01..10/`: Pastas individuais com fotos e `info.json` dos imóveis à venda.
- `imoveis/locacao/imovel_01..10/`: Pastas individuais com fotos e `info.json` dos imóveis para locação.

## Como Executar a Raspagem
```bash
pip install requests beautifulsoup4
python3 scraper.py
cat << 'EOF' > ~/Downloads/sitecloner-studio/dados_extraidos.json
{
"projeto": "SiteCloner Studio v2.0 - Realize Imobi Botucatu",
"url_origem": "https://www.realizeimobi.imb.br",
"venda": [
{"id": 1, "codigo": "imovel_01", "titulo": "Apto no Parque dos Pinheiros (Cond. Bulgária)", "endereco": "Rua Mário Spera, 408", "area": "40m²", "quartos": 2, "banheiros": 1, "vagas": 1, "preco": "R$ 205.000", "fotos_por_pasta": 10},
{"id": 2, "codigo": "imovel_02", "titulo": "Apto na Vila Juliana (Residencial Brunello)", "endereco": "Avenida Itália, 298", "area": "39m²", "quartos": 2, "banheiros": 1, "vagas": 1, "preco": "R$ 210.000", "fotos_por_pasta": 10},
{"id": 3, "codigo": "imovel_03", "titulo": "Apto Mobiliado no Jardim Paraíso (Parque Bavaria)", "endereco": "Rua Dr. José Barbosa de Barros, 1630", "area": "47m²", "quartos": 2, "banheiros": 1, "vagas": 1, "preco": "R$ 210.000", "fotos_por_pasta": 10},
{"id": 4, "codigo": "imovel_04", "titulo": "Apto Residencial Brunello II - Vila Juliana", "endereco": "Avenida Itália, 298", "area": "39m²", "quartos": 2, "banheiros": 1, "vagas": 1, "preco": "R$ 215.000", "fotos_por_pasta": 10},
{"id": 5, "codigo": "imovel_05", "titulo": "Apartamento Conjunto Residencial Frei Fidelis", "endereco": "Rua Nicola Zaponi, 1437", "area": "39m²", "quartos": 2, "banheiros": 1, "vagas": 1, "preco": "R$ 220.000", "fotos_por_pasta": 10},
{"id": 6, "codigo": "imovel_06", "titulo": "Apto com Suíte no Jardim Bom Pastor", "endereco": "Rua Mário Lopes Leão, 6", "area": "70m²", "quartos": 2, "banheiros": 2, "vagas": 1, "preco": "R$ 265.000", "fotos_por_pasta": 10},
{"id": 7, "codigo": "imovel_07", "titulo": "Casa Térrea Moderna no Jardim Paraíso", "endereco": "Rua Major Matheus, 890", "area": "140m²", "quartos": 3, "banheiros": 2, "vagas": 2, "preco": "R$ 420.000", "fotos_por_pasta": 10},
{"id": 8, "codigo": "imovel_08", "titulo": "Conjunto de Kitnets para Renda (Cohab 1)", "endereco": "Conjunto Flavio Américo", "area": "200m²", "quartos": 2, "banheiros": 1, "vagas": 2, "preco": "R$ 489.000", "fotos_por_pasta": 10},
{"id": 9, "codigo": "imovel_09", "titulo": "Sobrado Alto Padrão na Vila Assumpção", "endereco": "Rua Cardoso de Almeida, 1420", "area": "210m²", "quartos": 3, "banheiros": 3, "vagas": 2, "preco": "R$ 680.000", "fotos_por_pasta": 10},
{"id": 10, "codigo": "imovel_10", "titulo": "Residência em Condomínio Fechado Vale do Sol", "endereco": "Alameda das Hortênsias, 115", "area": "280m²", "quartos": 4, "banheiros": 4, "vagas": 4, "preco": "R$ 950.000", "fotos_por_pasta": 10}
],
"locacao": [
{"id": 11, "codigo": "imovel_01", "titulo": "Conjunto de 4 Salas Comerciais no Centro", "endereco": "Rua Djalma Dutra, 318", "area": "35m²", "quartos": 4, "banheiros": 1, "vagas": 0, "preco": "R$ 1.650/mês", "fotos_por_pasta": 10},
{"id": 12, "codigo": "imovel_02", "titulo": "Apartamento Novo na Chácara dos Pinheiros", "endereco": "Rua João Dias Cordeiro, 119", "area": "60m²", "quartos": 2, "banheiros": 2, "vagas": 2, "preco": "R$ 2.200/mês", "fotos_por_pasta": 10},
{"id": 13, "codigo": "imovel_03", "titulo": "Casa Espaçosa na Vila dos Lavradores", "endereco": "Rua Cruz Pereira, 74", "area": "300m²", "quartos": 3, "banheiros": 2, "vagas": 2, "preco": "R$ 2.500/mês", "fotos_por_pasta": 10},
{"id": 14, "codigo": "imovel_04", "titulo": "Casa Recém-Construída no Central Parque", "endereco": "Rua Augusto Mazzoni, 460", "area": "125m²", "quartos": 3, "banheiros": 2, "vagas": 2, "preco": "R$ 2.500/mês", "fotos_por_pasta": 10},
{"id": 15, "codigo": "imovel_05", "titulo": "Studio Comercial / Galpão Versátil na Vila Maria", "endereco": "Rua Cel. Joaquim Leandro de Oliveira, 282", "area": "220m²", "quartos": 1, "banheiros": 2, "vagas": 2, "preco": "R$ 2.900/mês", "fotos_por_pasta": 10},
{"id": 16, "codigo": "imovel_06", "titulo": "Sala Corporativa 130m² no Centro", "endereco": "Rua Siqueira Campos, 201", "area": "130m²", "quartos": 4, "banheiros": 2, "vagas": 1, "preco": "R$ 4.000/mês", "fotos_por_pasta": 10},
{"id": 17, "codigo": "imovel_07", "titulo": "Casa Completa Próxima ao Colégio Santa Marcelina", "endereco": "Rua Djalma Dutra, 734", "area": "240m²", "quartos": 4, "banheiros": 3, "vagas": 2, "preco": "R$ 4.500/mês", "fotos_por_pasta": 10},
{"id": 18, "codigo": "imovel_08", "titulo": "Apartamento Studio Próximo à UNESP Rubião", "endereco": "Av. Bento Lopes, 512", "area": "42m²", "quartos": 1, "banheiros": 1, "vagas": 1, "preco": "R$ 1.450/mês", "fotos_por_pasta": 10},
{"id": 19, "codigo": "imovel_09", "titulo": "Casa com Área Gourmet no Jardim Paraíso", "endereco": "Rua Dr. Costa Leite, 1910", "area": "180m²", "quartos": 3, "banheiros": 3, "vagas": 2, "preco": "R$ 3.200/mês", "fotos_por_pasta": 10},
{"id": 20, "codigo": "imovel_10", "titulo": "Ponto Comercial Esquina na Vila dos Lavradores", "endereco": "Rua Major Matheus, 410", "area": "160m²", "quartos": 2, "banheiros": 2, "vagas": 3, "preco": "R$ 5.500/mês", "fotos_por_pasta": 10}
]
}
