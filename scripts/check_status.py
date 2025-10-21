#### Version 1.2

import asyncio
import aiohttp
import json
import argparse
import aiohttp
from urllib.parse import quote
from datetime import datetime, UTC

async def check_service_status(session, url, expectedHttpRespose, timeout):
    try:
        async with session.get(url, timeout=timeout) as response:
            if '-' in expectedHttpRespose:
                start, end = map(int, expectedHttpRespose.split('-'))
                status_ok = start <= response.status <= end
            else:
                status_ok = response.status == int(expectedHttpRespose)

            print(f"URL: {url}: Status: {response.status}")
            return "online" if status_ok else "offline"

    except Exception as e:
        print(f"Erro ao verificar {url}: {type(e).__name__} - {e}")
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
            expectedHttpRespose = service.get('expectedHttpRespose')
            if url:
                tasks.append(check_service_status(session, url, expectedHttpRespose, timeout))
            else:
                tasks.append(asyncio.sleep(0))  # Placeholder para manter a ordem

        statuses = await asyncio.gather(*tasks)

    # Atualiza cada serviço com os resultados
    for service, status in zip(services, statuses):
        service['status'] = status
        await send_notification(data['notificationHook'], service)

        if status == "online":
            service['lastStatusOnline'] = now_utc
        else:
            service['lastStatusOffline'] = now_utc

        

    # Atualiza o campo geral de verificação
    data['lastChecked'] = now_utc

    # Grava o JSON atualizado
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Status atualizado com sucesso em: {filepath}")

async def send_notification(notificationHook, service):
    """
    Envia notificação para endpoint local caso o status atual tenha mudado para 'offline'.
    
    - name: nome do serviço
    - url: endereço do serviço monitorado
    - status: status atual ("online" ou "offline")
    - lastStatusOnline: última data/hora que foi online
    - lastStatusOffline: última data/hora que foi offline
    """

    if notificationHook == '':
        return
    
    name = service.get('name') or service.get('url')
    url = service.get('url')
    status = service.get('status')
    lastStatusOnline = service.get('lastStatusOnline')
    lastStatusOffline = service.get('lastStatusOffline')

    if status != "offline":
        return

    if lastStatusOffline and (not lastStatusOnline or lastStatusOffline > lastStatusOnline):
        return

    notify_url = (
        notificationHook
        .replace("{{name}}", quote(str(name)))
        .replace("{{url}}", quote(str(url)))
        .replace("{{status}}", quote(str(status)))
        .replace("{{lastStatusOffline}}", quote(str(lastStatusOffline)))
    )

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(notify_url) as response:
                if response.status < 400:
                    print(f"🔔 Notificação enviada com sucesso para {name} ({url})")
                else:
                    print(f"⚠️ Falha ao enviar notificação ({response.status}) para {name}")
    except Exception as e:
        print(f"Erro ao enviar notificação para {name} ({url}): {type(e).__name__} - {e}")

def main():
    parser = argparse.ArgumentParser(description="Verifica múltiplos serviços HTTP definidos em um JSON")
    parser.add_argument('json_file', help='Caminho para o arquivo JSON com as URLs a verificar')
    parser.add_argument('--timeout', type=int, default=5, help='Tempo limite das requisições (padrão: 5s)')
    args = parser.parse_args()

    asyncio.run(update_services_status(args.json_file, timeout=args.timeout))

if __name__ == "__main__":
    main()
