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


def user_ref(user):
    return {
        "email": user["email"],
        "nome": user["nome"],
        "documento": user["documento"],
        "telefone": user["telefone"],
    }


def build_data(total=80):
    produtos_base = [
        ("CAF", "Cafe Organico 500g", "alimentos", "Fazenda Minas Verdes LTDA"),
        ("ACU", "Acucar Refinado 1kg", "alimentos", "Usina Vale Claro"),
        ("SAL", "Sal Marinho 500g", "alimentos", "Salinas Atlantico"),
        ("ARR", "Arroz Integral 1kg", "alimentos", "Cooperativa Grao Vivo"),
        ("MEL", "Mel Silvestre 300g", "alimentos", "Apiario Serra Azul"),
        ("CHA", "Cha Verde 40g", "bebidas", "Ervas do Cerrado"),
        ("AZE", "Azeite Extra Virgem 500ml", "alimentos", "Oliva Sul Brasil"),
        ("CAC", "Cacau em Po 200g", "alimentos", "Cacau Bahia Premium"),
    ]
    cidades = [
        ("Uberlandia", "MG", -18.9186, -48.2772),
        ("Ribeirao Preto", "SP", -21.1699, -47.8099),
        ("Sao Paulo", "SP", -23.5505, -46.6333),
        ("Campinas", "SP", -22.9056, -47.0608),
        ("Belo Horizonte", "MG", -19.9167, -43.9345),
        ("Goiania", "GO", -16.6869, -49.2648),
        ("Curitiba", "PR", -25.4284, -49.2733),
        ("Rio de Janeiro", "RJ", -22.9068, -43.1729),
        ("Vitoria", "ES", -20.3155, -40.3128),
        ("Brasilia", "DF", -15.7939, -47.8828),
    ]

    # As 5 contas base do sistema. Cada uma assume um papel diferente em cada produto
    # (remetente, recebedor, destinatario ou auditor) por meio de um rodizio (modulo 5).
    usuarios = [
        {
            "email": "joao.silva@origemcerta.com",
            "login": "joao.silva",
            "nome": "Joao da Silva",
            "documento": "123.456.789-10",
            "telefone": "(34) 99999-0001",
            "endereco": {"logradouro": "Rua das Acacias", "numero": "120", "cidade": "Uberlandia", "estado": "MG", "cep": "38400-000"},
            "cargo": "Operador de armazem",
            "perfil": "operador",
            "ativo": True,
            "setor": "operacao",
        },
        {
            "email": "maria.oliveira@origemcerta.com",
            "login": "maria.oliveira",
            "nome": "Maria Oliveira",
            "documento": "234.567.890-11",
            "telefone": "(11) 98888-0002",
            "endereco": {"logradouro": "Avenida Paulista", "numero": "900", "cidade": "Sao Paulo", "estado": "SP", "cep": "01310-000"},
            "cargo": "Auditora de riscos",
            "perfil": "auditor",
            "ativo": True,
            "setor": "auditoria",
        },
        {
            "email": "ana.souza@origemcerta.com",
            "login": "ana.souza",
            "nome": "Ana Souza",
            "documento": "345.678.901-12",
            "telefone": "(31) 97777-0003",
            "endereco": {"logradouro": "Rua da Bahia", "numero": "450", "cidade": "Belo Horizonte", "estado": "MG", "cep": "30160-011"},
            "cargo": "Gestora logistica",
            "perfil": "gestor",
            "ativo": True,
            "setor": "gestao",
        },
        {
            "email": "carlos.lima@origemcerta.com",
            "login": "carlos.lima",
            "nome": "Carlos Lima",
            "documento": "456.789.012-13",
            "telefone": "(21) 96666-0004",
            "endereco": {"logradouro": "Rua Uruguaiana", "numero": "77", "cidade": "Rio de Janeiro", "estado": "RJ", "cep": "20050-090"},
            "cargo": "Recebedor de mercadorias",
            "perfil": "operador",
            "ativo": True,
            "setor": "recebimento",
        },
        {
            "email": "beatriz.rocha@origemcerta.com",
            "login": "beatriz.rocha",
            "nome": "Beatriz Rocha",
            "documento": "567.890.123-14",
            "telefone": "(41) 95555-0005",
            "endereco": {"logradouro": "Rua XV de Novembro", "numero": "300", "cidade": "Curitiba", "estado": "PR", "cep": "80020-310"},
            "cargo": "Cliente destinataria",
            "perfil": "cliente",
            "ativo": True,
            "setor": "cliente",
        },
    ]

    produtos = []
    for i in range(total):
        prefixo, nome_produto, categoria, fabricante = produtos_base[i % len(produtos_base)]
        codigo = f"{prefixo}-TRK-{i + 1:04d}"
        nota_numero = f"NF-2026-{i + 1:05d}"

        origem_cidade = cidades[i % len(cidades)]
        destino_cidade = cidades[(i + 3) % len(cidades)]
        origem = {
            "nome": f"Origem {origem_cidade[0]}",
            "tipo": "origem",
            "cidade": origem_cidade[0],
            "estado": origem_cidade[1],
            "pais": "Brasil",
            "coordenadas": {"latitude": origem_cidade[2], "longitude": origem_cidade[3]},
        }
        destino = {
            "nome": f"Destino {destino_cidade[0]}",
            "tipo": "destino",
            "cidade": destino_cidade[0],
            "estado": destino_cidade[1],
            "pais": "Brasil",
            "coordenadas": {"latitude": destino_cidade[2], "longitude": destino_cidade[3]},
        }

        tem_alerta = i % 3 == 0
        gravidade = "alta" if i % 9 == 0 else "media"
        quantidade = 60 + (i * 7) % 400
        divergencia = 3 + (i % 5) if tem_alerta else 0
        quantidade_confirmada = max(0, quantidade - divergencia)

        atual = (
            {"nome": f"Ponto nao autorizado {destino_cidade[0]}", "cidade": destino_cidade[0], "estado": destino_cidade[1]}
            if tem_alerta
            else {"nome": destino["nome"], "cidade": destino["cidade"], "estado": destino["estado"]}
        )
        status_atual = "em_alerta" if tem_alerta else ["recebido", "em_transito", "autenticado"][i % 3]

        remetente = usuarios[i % 5]
        recebedor = usuarios[(i + 1) % 5]
        destinatario = usuarios[(i + 2) % 5]
        auditor = usuarios[(i + 3) % 5]

        movimentacoes = [
            {
                "codigo": f"MOV-2026-{i + 1:04d}-1",
                "tipo": "produto_cadastrado",
                "data_hora": f"2026-06-{(i % 28) + 1:02d}T08:{i % 60:02d}:00Z",
                "origem": origem["nome"],
                "destino": destino["nome"],
                "usuario_responsavel": user_ref(remetente),
                "quantidade_informada": quantidade,
                "quantidade_confirmada": quantidade,
                "verificacao": {"resultado": "regular", "motivos": []},
            },
            {
                "codigo": f"MOV-2026-{i + 1:04d}-2",
                "tipo": "saida_origem",
                "data_hora": f"2026-06-{(i % 28) + 1:02d}T11:{(i + 1) % 60:02d}:00Z",
                "origem": origem["nome"],
                "destino": destino["nome"],
                "usuario_responsavel": user_ref(remetente),
                "quantidade_informada": quantidade,
                "quantidade_confirmada": quantidade,
                "verificacao": {"resultado": "regular", "motivos": []},
            },
            {
                "codigo": f"MOV-2026-{i + 1:04d}-3",
                "tipo": "entrada_destino",
                "data_hora": f"2026-06-{(i % 28) + 1:02d}T14:{(i + 2) % 60:02d}:00Z",
                "origem": atual["nome"] if tem_alerta else origem["nome"],
                "destino": destino["nome"],
                "usuario_responsavel": user_ref(recebedor),
                "quantidade_informada": quantidade,
                "quantidade_confirmada": quantidade,
                "verificacao": {"resultado": "regular", "motivos": []},
            },
            {
                "codigo": f"MOV-2026-{i + 1:04d}-4",
                "tipo": "conferencia_recebimento",
                "data_hora": f"2026-06-{(i % 28) + 1:02d}T17:{(i + 3) % 60:02d}:00Z",
                "origem": atual["nome"] if tem_alerta else origem["nome"],
                "destino": destino["nome"],
                "usuario_responsavel": user_ref(recebedor),
                "quantidade_informada": quantidade,
                "quantidade_confirmada": quantidade_confirmada,
                "verificacao": (
                    {"resultado": "suspeito", "motivos": ["produto_fora_do_local_desejado"]}
                    if tem_alerta
                    else {"resultado": "regular", "motivos": []}
                ),
            },
        ]

        alertas = []
        if tem_alerta:
            alertas.append(
                {
                    "codigo": f"ALT-2026-{i + 1:04d}",
                    "tipo": "produto_fora_do_local_desejado",
                    "descricao": "O produto saiu ou permaneceu fora do local desejado para entrega.",
                    "gravidade": gravidade,
                    "status": "resolvido" if i % 2 == 0 else "em_analise",
                    "data_emissao": f"2026-06-{(i % 28) + 1:02d}T17:00:00Z",
                    "movimentacao": movimentacoes[-1]["codigo"],
                    "responsavel_auditoria": user_ref(auditor),
                    "local_desejado": destino["nome"],
                    "local_registrado": atual["nome"],
                }
            )

        produtos.append(
            {
                "codigo": codigo,
                "nome": nome_produto,
                "categoria": categoria,
                "fabricante": fabricante,
                "status_atual": status_atual,
                "nota_fiscal": {
                    "numero": nota_numero,
                    "emissor": fabricante,
                    "destinatario": destinatario["nome"],
                    "data_emissao": f"2026-06-{(i % 28) + 1:02d}T08:00:00Z",
                    "quantidade_declarada": quantidade,
                    "valor_total": round(1500 + (i * 137.45), 2),
                    "status_validacao": "em_analise" if tem_alerta else "valida",
                },
                "movimentacoes": movimentacoes,
                "alertas": alertas,
                "locais": {
                    "origem": origem,
                    "destino": destino,
                    "local_desejado": destino["nome"],
                    "atual": atual,
                },
                "usuarios_associados": {
                    "remetente": user_ref(remetente),
                    "destinatario": user_ref(destinatario),
                    "recebedor": user_ref(recebedor),
                },
                "_remetente_email": remetente["email"],
                "_destinatario_email": destinatario["email"],
            }
        )

    usuarios_docs = []
    for user in usuarios:
        enviados = [
            {"codigo": p["codigo"], "nome": p["nome"], "nota_fiscal": p["nota_fiscal"]["numero"]}
            for p in produtos
            if p["_remetente_email"] == user["email"]
        ]
        destinados = [
            {"codigo": p["codigo"], "nome": p["nome"], "nota_fiscal": p["nota_fiscal"]["numero"]}
            for p in produtos
            if p["_destinatario_email"] == user["email"]
        ]
        usuarios_docs.append(
            {
                **user,
                "produtos_destinados": destinados,
                "produtos_enviados": enviados,
            }
        )

    for produto in produtos:
        del produto["_remetente_email"]
        del produto["_destinatario_email"]

    return {"produtos": produtos, "usuarios": usuarios_docs}


DATA = build_data(80)


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

        # Indices ja existentes na modelagem embutida (produtos + usuarios).
        await db.produtos.create_index("codigo", unique=True)
        await db.produtos.create_index("nota_fiscal.numero", unique=True)
        await db.produtos.create_index("usuarios_associados.destinatario.email")
        await db.produtos.create_index("usuarios_associados.recebedor.email")
        await db.produtos.create_index("alertas.codigo")
        await db.usuarios.create_index("email", unique=True)
        await db.usuarios.create_index("login", unique=True)
        await db.usuarios.create_index("produtos_destinados.codigo")

        # Indices novos desta entrega, criados para sustentar as 2 aggregation pipelines
        # (ver README.md > Aggregation Pipelines).
        await db.produtos.create_index(
            [("alertas.status", 1), ("alertas.gravidade", 1)], name="alertas.status_gravidade"
        )
        await db.usuarios.create_index([("ativo", 1), ("setor", 1)], name="ativo_setor")
    except ServerSelectionTimeoutError as exc:
        raise SystemExit(
            "Não foi possível conectar ao MongoDB. Confira se backend/.env tem a MONGODB_URI "
            "do MongoDB Atlas, se usuário/senha estão corretos e se o IP está liberado em "
            "Network Access no Atlas.\n\nErro original:\n"
            f"{exc}"
        ) from exc
    finally:
        client.close()

    print(f"Banco '{MONGODB_DB}' populado com dados de exemplo (schema embutido: produtos + usuarios).")


if __name__ == "__main__":
    asyncio.run(main())
