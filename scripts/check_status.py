#pip install aiohttp
import asyncio
import aiohttp
import json
import argparse
from datetime import datetime, UTC

async def check_service_status(session, url, timeout):
    try:
        async with session.get(url, timeout=timeout) as response:
            return "online" if response.status < 400 else "offline"
    except Exception:
        return "offline"

async def update_services_status(filepath, timeout=5):
    # Lê o conteúdo atual do JSON
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    now_utc = datetime.now(UTC).isoformat()

    services = data.get('servicesStatus', [])

    async with aiohttp.ClientSession() as session:
        tasks = []
        for service in services:
            url = service.get('url')
            if url:
                tasks.append(check_service_status(session, url, timeout))
            else:
                tasks.append(asyncio.sleep(0))  # Placeholder para manter a ordem

        statuses = await asyncio.gather(*tasks)

    # Atualiza cada serviço com os resultados
    for service, status in zip(services, statuses):
        service['status'] = status
        if status == "online":
            service['lastStatusOnline'] = now_utc
        else:
            service['lastStatusOffline'] = now_utc  # Corrigida grafia

    # Atualiza o campo geral de verificação
    data['lastChecked'] = now_utc

    # Grava o JSON atualizado
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Status atualizado com sucesso em: {filepath}")

def main():
    parser = argparse.ArgumentParser(description="Verifica múltiplos serviços HTTP definidos em um JSON")
    parser.add_argument('json_file', help='Caminho para o arquivo JSON com as URLs a verificar')
    parser.add_argument('--timeout', type=int, default=5, help='Tempo limite das requisições (padrão: 5s)')
    args = parser.parse_args()

    asyncio.run(update_services_status(args.json_file, timeout=args.timeout))

if __name__ == "__main__":
    main()
