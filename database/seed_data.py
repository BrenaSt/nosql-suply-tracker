import asyncio
import os
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_CANDIDATES = [
    PROJECT_ROOT / ".env",
    PROJECT_ROOT.parent / "backend" / ".env",
]

for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(env_path)
        break

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "origem-certa")


def build_data(total=120):
    produtos_base = [
        ("CAF", "Café Orgânico 500g", "alimentos", "Fazenda Minas Verdes LTDA"),
        ("ACU", "Açúcar Refinado 1kg", "alimentos", "Usina Vale Claro"),
        ("SAL", "Sal Marinho 500g", "alimentos", "Salinas Atlântico"),
        ("ARR", "Arroz Integral 1kg", "alimentos", "Cooperativa Grão Vivo"),
        ("MEL", "Mel Silvestre 300g", "alimentos", "Apiário Serra Azul"),
        ("CHA", "Chá Verde 40g", "bebidas", "Ervas do Cerrado"),
        ("AZE", "Azeite Extra Virgem 500ml", "alimentos", "Oliva Sul Brasil"),
        ("CAC", "Cacau em Pó 200g", "alimentos", "Cacau Bahia Premium"),
    ]
    cidades = [
        ("Uberlândia", "MG", -18.9186, -48.2772),
        ("Ribeirão Preto", "SP", -21.1699, -47.8099),
        ("São Paulo", "SP", -23.5505, -46.6333),
        ("Campinas", "SP", -22.9056, -47.0608),
        ("Belo Horizonte", "MG", -19.9167, -43.9345),
        ("Goiânia", "GO", -16.6869, -49.2648),
        ("Curitiba", "PR", -25.4284, -49.2733),
        ("Rio de Janeiro", "RJ", -22.9068, -43.1729),
        ("Vitória", "ES", -20.3155, -40.3128),
        ("Brasília", "DF", -15.7939, -47.8828),
    ]
    tipos_local = ["fabrica", "armazem", "centro_distribuicao", "loja", "transportadora"]
    usuarios = ["João da Silva", "Maria Oliveira", "Ana Souza", "Carlos Lima", "Beatriz Rocha"]
    usuarios_docs = [
        {
            "email": "joao.silva@origemcerta.com",
            "nome": "João da Silva",
            "cargo": "Operador de Armazém",
            "perfil": "operador",
            "ativo": True,
            "setor": "operacao",
        },
        {
            "email": "maria.oliveira@origemcerta.com",
            "nome": "Maria Oliveira",
            "cargo": "Auditora de Riscos",
            "perfil": "auditor",
            "ativo": True,
            "setor": "auditoria",
        },
        {
            "email": "ana.souza@origemcerta.com",
            "nome": "Ana Souza",
            "cargo": "Gestora Logística",
            "perfil": "gestor",
            "ativo": True,
            "setor": "gestao",
        },
        {
            "email": "carlos.lima@origemcerta.com",
            "nome": "Carlos Lima",
            "cargo": "Operador de Transporte",
            "perfil": "operador",
            "ativo": True,
            "setor": "operacao",
        },
        {
            "email": "beatriz.rocha@origemcerta.com",
            "nome": "Beatriz Rocha",
            "cargo": "Auditora Fiscal",
            "perfil": "auditor",
            "ativo": True,
            "setor": "auditoria",
        },
    ]
    eventos = ["produto_cadastrado", "saida_fabrica", "entrada_armazem", "saida_distribuicao", "entrega_confirmada"]
    status_produto = ["cadastrado", "em_transito", "armazenado", "entregue", "autenticado"]
    tipos_alerta = [
        ("divergencia_quantidade", "Quantidade confirmada diferente da quantidade informada."),
        ("rota_inconsistente", "Produto passou por uma rota diferente da prevista."),
        ("consulta_duplicada", "Código consultado em locais diferentes em intervalo curto."),
        ("nota_reutilizada", "Nota fiscal encontrada em mais de uma operação."),
        ("origem_nao_reconhecida", "Origem registrada não consta entre locais autorizados."),
    ]

    locais = []
    for i in range(total):
        cidade, estado, lat, lng = cidades[i % len(cidades)]
        tipo = tipos_local[i % len(tipos_local)]
        locais.append(
            {
                "nome": f"{tipo.replace('_', ' ').title()} {cidade} {i + 1:03d}",
                "tipo": tipo,
                "cidade": cidade,
                "estado": estado,
                "pais": "Brasil",
                "coordenadas": {
                    "latitude": round(lat + ((i % 7) * 0.011), 6),
                    "longitude": round(lng - ((i % 5) * 0.013), 6),
                },
            }
        )

    notas_fiscais = []
    lotes = []
    produtos = []
    movimentacoes = []
    alertas = []

    for i in range(total):
        prefixo, nome_produto, categoria, fabricante = produtos_base[i % len(produtos_base)]
        produto_codigo = f"{prefixo}-TRK-{i + 1:04d}"
        lote_codigo = f"LOTE-{prefixo}-2026-{i + 1:04d}"
        nota_numero = f"NF-2026-{i + 1:05d}"
        origem = locais[(i * 2) % len(locais)]
        destino = locais[(i * 2 + 7) % len(locais)]
        quantidade_prevista = 120 + (i * 9) % 880
        tem_alerta = i % 3 == 0
        risco = "alto" if i % 15 == 0 else "medio" if tem_alerta else "baixo"
        divergencia = 2 + (i % 6) if tem_alerta else 0
        quantidade_confirmada = max(0, quantidade_prevista - divergencia)
        status = status_produto[i % len(status_produto)]

        notas_fiscais.append(
            {
                "numero": nota_numero,
                "emissor": fabricante,
                "destinatario": destino["nome"],
                "data_emissao": f"2026-06-{(i % 28) + 1:02d}T08:{i % 60:02d}:00Z",
                "quantidade_declarada": quantidade_prevista,
                "valor_total": round(1800 + (i * 137.45), 2),
                "status_validacao": "suspeita" if risco == "alto" else "valida",
            }
        )

        lotes.append(
            {
                "codigo": lote_codigo,
                "produto_base": nome_produto,
                "fabricante": fabricante,
                "origem": origem["nome"],
                "destino_previsto": destino["nome"],
                "quantidade_prevista": quantidade_prevista,
                "quantidade_confirmada": quantidade_confirmada,
                "status": status,
                "nota_fiscal": nota_numero,
                "indicadores_risco": {"possui_alerta": tem_alerta, "nivel_risco": risco},
            }
        )

        historico_recente = []
        for passo in range(2):
            evento = eventos[(i + passo) % len(eventos)]
            local = origem if passo == 0 else destino
            historico_recente.append(
                {
                    "tipo": evento,
                    "data_hora": f"2026-06-{(i % 28) + 1:02d}T{8 + passo * 4:02d}:{(i + passo) % 60:02d}:00Z",
                    "local": local["nome"],
                }
            )

        alertas_ativos = []
        if tem_alerta:
            tipo_alerta, _ = tipos_alerta[i % len(tipos_alerta)]
            alertas_ativos.append(
                {
                    "tipo": tipo_alerta,
                    "gravidade": "alta" if risco == "alto" else "media",
                    "status": "em_analise",
                }
            )

        produtos.append(
            {
                "codigo": produto_codigo,
                "nome": nome_produto,
                "categoria": categoria,
                "lote": lote_codigo,
                "fabricante": fabricante,
                "status_atual": status,
                "localizacao_atual": {"nome": destino["nome"], "cidade": destino["cidade"], "estado": destino["estado"]},
                "ultima_movimentacao": historico_recente[-1]["tipo"],
                "ultimas_movimentacoes": historico_recente,
                "alertas_ativos": alertas_ativos,
            }
        )

        for passo in range(2):
            evento = eventos[(i + passo + 1) % len(eventos)]
            suspeito = tem_alerta and passo == 1
            movimentacoes.append(
                {
                    "codigo": f"MOV-2026-{i * 2 + passo + 1:04d}",
                    "produto": produto_codigo,
                    "lote": lote_codigo,
                    "tipo": evento,
                    "status_resultante": status,
                    "data_hora": f"2026-06-{(i % 28) + 1:02d}T{9 + passo * 5:02d}:{(i * 3 + passo) % 60:02d}:00Z",
                    "origem": origem["nome"],
                    "destino": destino["nome"],
                    "usuario": usuarios[(i + passo) % len(usuarios)],
                    "nota_fiscal": nota_numero,
                    "quantidade_informada": quantidade_prevista,
                    "quantidade_confirmada": quantidade_confirmada if passo == 1 else quantidade_prevista,
                    "verificacao": {
                        "resultado": "suspeito" if suspeito else "regular",
                        "motivos": ["divergencia_quantidade"] if suspeito else [],
                    },
                }
            )

        tipo_alerta, descricao_alerta = tipos_alerta[i % len(tipos_alerta)]
        alertas.append(
            {
                "codigo": f"ALT-2026-{i + 1:04d}",
                "tipo": tipo_alerta,
                "descricao": descricao_alerta,
                "gravidade": "alta" if i % 5 == 0 else "media" if i % 2 == 0 else "baixa",
                "status": "resolvido" if i % 4 == 0 else "em_analise",
                "produto": produto_codigo,
                "lote": lote_codigo,
                "movimentacao": eventos[(i + 2) % len(eventos)],
                "data_emissao": f"2026-06-{(i % 28) + 1:02d}T14:{(i * 7) % 60:02d}:00Z",
                "responsavel_auditoria": usuarios[(i + 1) % len(usuarios)],
            }
        )

    return {
        "usuarios": usuarios_docs,
        "lotes": lotes,
        "produtos": produtos,
        "movimentacoes": movimentacoes,
        "alertas": alertas,
        "locais": locais,
        "notas_fiscais": notas_fiscais,
    }


DATA = build_data(120)


async def main():
    if not MONGODB_URI:
        raise SystemExit(
            "MONGODB_URI não foi encontrado. Crie origem-certa-mongodb/.env com sua string do MongoDB Atlas "
            "ou mantenha o arquivo backend/.env do projeto original "
            "ou defina a variável de ambiente MONGODB_URI."
        )

    client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
    db = client[MONGODB_DB]
    try:
        await client.admin.command("ping")
        for collection_name, documents in DATA.items():
            collection = db[collection_name]
            await collection.delete_many({})
            if documents:
                await collection.insert_many(documents)
        await db.produtos.create_index("codigo", unique=True)
        await db.lotes.create_index("codigo", unique=True)
        await db.notas_fiscais.create_index("numero", unique=True)
        await db.usuarios.create_index("email", unique=True)
        await db.movimentacoes.create_index("codigo", unique=True)
        await db.alertas.create_index("codigo", unique=True)
        await db.movimentacoes.create_index("produto")
        await db.alertas.create_index("produto")
    except ServerSelectionTimeoutError as exc:
        raise SystemExit(
            "Não foi possível conectar ao MongoDB. Confira se backend/.env tem a MONGODB_URI "
            "do MongoDB Atlas, se usuário/senha estão corretos e se o IP está liberado em "
            "Network Access no Atlas.\n\nErro original:\n"
            f"{exc}"
        ) from exc
    finally:
        client.close()

    print(f"Banco '{MONGODB_DB}' populado com dados de exemplo.")


if __name__ == "__main__":
    asyncio.run(main())
