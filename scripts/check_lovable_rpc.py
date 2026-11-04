"""Smoke test Lovable Auth and the BeaMotion RPCs without printing client data."""

import argparse
import getpass
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


def read_env_file(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip("\"'")
    return values


def request_json(base: str, path: str, key: str, *, token=None, body=None):
    headers = {"apikey": key, "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = Request(
        urljoin(base.rstrip("/") + "/", path.lstrip("/")),
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=headers,
        method="POST" if body is not None else "GET",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        try:
            payload = json.load(error)
        except (ValueError, OSError):
            payload = {}
        return error.code, payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        type=Path,
        help="Archivo .env del clon Lovable (solo se leen URL y clave publicable)",
    )
    args = parser.parse_args()

    try:
        config = dict(os.environ)
        if args.env_file:
            config.update(read_env_file(args.env_file))
    except OSError as error:
        print(f"No se pudo leer el archivo de configuración: {error.strerror}")
        return 2
    base = config.get("SUPABASE_URL", "")
    key = config.get("SUPABASE_PUBLISHABLE_KEY", "")
    if not base.startswith("https://") or not key:
        print("Faltan SUPABASE_URL (HTTPS) o SUPABASE_PUBLISHABLE_KEY.")
        return 2

    try:
        status, _ = request_json(base, "/auth/v1/health", key)
        print(f"Auth accesible: HTTP {status}")
        if status != 200:
            return 1

        email = input("Correo de la cuenta admin: ").strip()
        password = getpass.getpass("Contraseña (no se mostrará): ")
        status, auth = request_json(
            base,
            "/auth/v1/token?grant_type=password",
            key,
            body={"email": email, "password": password},
        )
        del password
        print(f"Inicio de sesión: HTTP {status}")
        if status != 200 or not isinstance(auth, dict) or not auth.get("access_token"):
            return 1

        token = auth["access_token"]
        status, listing = request_json(
            base, "/rest/v1/rpc/list_clients", key, token=token, body={"p_limit": 1}
        )
        code = listing.get("code", "") if isinstance(listing, dict) else ""
        print(f"list_clients: HTTP {status}" + (f" ({code})" if code else ""))
        if status != 200 or not isinstance(listing, dict):
            return 1

        clients = listing.get("clients")
        if not isinstance(clients, list):
            print("La respuesta de list_clients no tiene el formato esperado.")
            return 1
        if not clients:
            print("Sin clientas visibles: no se puede probar client_overview.")
            return 2

        client_id = clients[0].get("id") if isinstance(clients[0], dict) else None
        if not isinstance(client_id, str):
            print("La lista no contiene un identificador de clienta válido.")
            return 1
        status, overview = request_json(
            base,
            "/rest/v1/rpc/client_overview",
            key,
            token=token,
            body={
                "p_client_id": client_id,
                "p_history_limit": 1,
                "p_notes_limit": 1,
                "p_journal_limit": 1,
            },
        )
        code = overview.get("code", "") if isinstance(overview, dict) else ""
        print(f"client_overview: HTTP {status}" + (f" ({code})" if code else ""))
        if status != 200 or not isinstance(overview, dict) or not overview.get("client"):
            return 1
        print("Prueba completa: autenticación y lectura RPC correctas.")
        return 0
    except (OSError, URLError, ValueError, json.JSONDecodeError) as error:
        print(f"Error de conexión o respuesta: {type(error).__name__}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
