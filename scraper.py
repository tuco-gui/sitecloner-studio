import os
import re
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

BASE_URL = "https://www.realizeimobi.imb.br"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

CATEGORIAS = {
    "venda": f"{BASE_URL}/imoveis/a-venda/botucatu-sp?order=mais_relevantes",
    "locacao": f"{BASE_URL}/imoveis/para-alugar/botucatu-sp?order=mais_relevantes"
}

def baixar_arquivo(url, destino):
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            with open(destino, "wb") as f:
                f.write(r.content)
            return True
    except Exception:
        pass
    return False

def extrair_logotipo(soup):
    pasta_logo = os.path.join(ROOT_DIR, "assets", "logo")
    os.makedirs(pasta_logo, exist_ok=True)
    logo_img = soup.find("img", src=lambda s: s and "logo" in s.lower())
    if not logo_img and soup.find("header"):
        logo_img = soup.find("header").find("img")
    if logo_img and logo_img.get("src"):
        url_logo = urljoin(BASE_URL, logo_img.get("src"))
        baixar_arquivo(url_logo, os.path.join(pasta_logo, "logo-principal.png"))
        print(f"[LOGO] Salvo em {pasta_logo}/logo-principal.png")

def raspar_categoria(tipo, url, limite_imoveis=10, fotos_por_imovel=10):
    print(f"\n=== Raspando {limite_imoveis} imóveis de {tipo.upper()} (até {fotos_por_imovel} fotos cada) ===")
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Erro HTTP {resp.status_code} ao acessar {url}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    extrair_logotipo(soup)

    cards = soup.select("article") or soup.find_all("div", class_=lambda c: c and "card" in c.lower())
    imoveis_extraidos = []
    vistos = set()
    cont = 1

    for card in cards:
        texto = card.get_text(" ", strip=True)
        if len(texto) < 30:
            continue
        titulo_el = card.find(["h2", "h3"])
        titulo = titulo_el.get_text(strip=True) if titulo_el else texto[:50]
        if titulo[:35] in vistos:
            continue
        vistos.add(titulo[:35])

        pasta_imovel = os.path.join(ROOT_DIR, "imoveis", tipo, f"imovel_{cont:02d}")
        os.makedirs(pasta_imovel, exist_ok=True)

        preco_m = re.search(r"R\$\s*[\d\.,]+", texto)
        preco = preco_m.group(0) if preco_m else "Sob Consulta"

        imgs = []
        for img in card.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy")
            if src and not src.endswith(".svg") and "logo" not in src.lower():
                full = urljoin(BASE_URL, src)
                if full not in imgs:
                    imgs.append(full)

        for idx_foto, f_url in enumerate(imgs[:fotos_por_imovel], start=1):
            baixar_arquivo(f_url, os.path.join(pasta_imovel, f"foto_{idx_foto:02d}.jpg"))

        info = {
            "id": cont,
            "codigo": f"imovel_{cont:02d}",
            "tipo": tipo,
            "titulo": titulo,
            "preco": preco,
            "descricao": texto,
            "pasta": f"imoveis/{tipo}/imovel_{cont:02d}",
            "total_fotos": len(imgs[:fotos_por_imovel])
        }
        with open(os.path.join(pasta_imovel, "info.json"), "w", encoding="utf-8") as f:
            json.dump(info, f, ensure_ascii=False, indent=2)

        imoveis_extraidos.append(info)
        print(f"[{cont}/{limite_imoveis}] {titulo[:40]} | {preco}")
        cont += 1
        if cont > limite_imoveis:
            break

    return imoveis_extraidos

if __name__ == "__main__":
    resultado = {cat: raspar_categoria(cat, u, 10, 10) for cat, u in CATEGORIAS.items()}
    caminho_json = os.path.join(ROOT_DIR, "dados_extraidos.json")
    with open(caminho_json, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print(f"\nConcluído! Dados salvos em: {caminho_json}")
