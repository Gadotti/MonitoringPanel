#Version 1.0

import sys
import asyncio
import json
import argparse
from urllib.parse import quote
from datetime import datetime, UTC
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

_SCRIPT_DIR  = Path(__file__).parent
_SCRIPT_NAME = Path(__file__).stem   # "check_systemd"
_MAX_LOG_SIZE = 500 * 1024           # 500 KB


def _write_log(message: str, log_dir: Path) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"{_SCRIPT_NAME}.log"
    if log_file.exists() and log_file.stat().st_size >= _MAX_LOG_SIZE:
        old_file = log_dir / f"{_SCRIPT_NAME}_old.old"
        log_file.rename(old_file)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"{timestamp}: {message}\n")


async def check_systemd_service(service_name: str, timeout: int) -> str:
    """Returns 'online' if the systemd service is active, 'offline' otherwise."""
    try:
        proc = await asyncio.wait_for(
            asyncio.create_subprocess_exec(
                "systemctl", "is-active", service_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            ),
            timeout=timeout,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        state = stdout.decode().strip()
        print(f"Service: {service_name}: State: {state}")
        return "online" if state == "active" else "offline"
    except asyncio.TimeoutError:
        print(f"Service: {service_name}: Timeout ao executar systemctl")
        return "offline"
    except FileNotFoundError:
        print(f"Service: {service_name}: Erro — systemctl não encontrado (não é Linux ou systemd indisponível)")
        return "offline"
    except Exception as e:
        print(f"Erro ao verificar {service_name}: {type(e).__name__} - {e}")
        return "offline"


async def update_services_status(filepath, timeout=5, log_dir: Path = None):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    now_utc = datetime.now(UTC).isoformat()
    services = data.get('servicesStatus', [])

    tasks = [
        check_systemd_service(svc.get('service', ''), timeout)
        for svc in services
    ]
    statuses = await asyncio.gather(*tasks)

    for service, status in zip(services, statuses):
        service['status'] = status
        await send_notification(data['notificationHook'], service, log_dir=log_dir)

        if status == "online":
            service['lastStatusOnline'] = now_utc
        else:
            service['lastStatusOffline'] = now_utc

    data['lastChecked'] = now_utc

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Status atualizado com sucesso em: {filepath}")


async def send_notification(notificationHook, service, log_dir: Path = None):
    """
    Envia notificação para endpoint local conforme o modo configurado em 'notificationHookMode'.

    Modos disponíveis:
    - "off"          : Nunca envia notificação.
    - "when-online"  : Envia notificação quando o serviço ficar online (apenas na transição).
    - "when-offline" : Envia notificação quando o serviço ficar offline (apenas na transição).

    Campos do serviço utilizados:
    - name                 : nome de exibição do serviço
    - service              : nome do unit systemd (ex: nginx, postgresql)
    - status               : status atual ("online" ou "offline")
    - notificationHookMode : modo de notificação (padrão: "when-offline")
    - lastStatusOnline     : última data/hora que ficou online
    - lastStatusOffline    : última data/hora que ficou offline

    Placeholders suportados no notificationHook:
    - {{name}}              : nome de exibição
    - {{service}}           : nome do unit systemd
    - {{status}}            : status atual
    - {{lastStatusOffline}} : última vez offline
    """
    if notificationHook == '':
        return

    mode = service.get('notificationHookMode', 'when-offline')

    if mode == 'off':
        return

    name               = service.get('name') or service.get('service')
    service_name       = service.get('service')
    status             = service.get('status')
    lastStatusOnline   = service.get('lastStatusOnline')
    lastStatusOffline  = service.get('lastStatusOffline')

    if mode == 'when-offline':
        if status != 'offline':
            return
        if lastStatusOffline and (not lastStatusOnline or lastStatusOffline > lastStatusOnline):
            return

    elif mode == 'when-online':
        if status != 'online':
            return
        if lastStatusOnline and (not lastStatusOffline or lastStatusOnline > lastStatusOffline):
            return

    else:
        msg = f"notificationHookMode desconhecido: '{mode}'. Notificação ignorada para {name}."
        print(msg)
        if log_dir is not None:
            _write_log(msg, log_dir)
        return

    import aiohttp
    notify_url = (
        notificationHook
        .replace("{{name}}", quote(str(name)))
        .replace("{{service}}", quote(str(service_name)))
        .replace("{{status}}", quote(str(status)))
        .replace("{{lastStatusOffline}}", quote(str(lastStatusOffline)))
    )

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(notify_url) as response:
                if response.status < 400:
                    msg = f"Notificação enviada com sucesso para {name} ({service_name})"
                    print(msg)
                    if log_dir is not None:
                        _write_log(msg, log_dir)
                else:
                    msg = f"Falha ao enviar notificação ({response.status}) para {name}"
                    print(msg)
                    if log_dir is not None:
                        _write_log(msg, log_dir)
    except Exception as e:
        msg = f"Erro ao enviar notificação para {name} ({service_name}): {type(e).__name__} - {e}"
        print(msg)
        if log_dir is not None:
            _write_log(msg, log_dir)


def main():
    parser = argparse.ArgumentParser(description="Verifica múltiplos serviços systemd definidos em um JSON")
    parser.add_argument('json_file', help='Caminho para o arquivo JSON com os serviços a verificar')
    parser.add_argument('--timeout', type=int, default=5, help='Tempo limite para execução do systemctl (padrão: 5s)')
    parser.add_argument(
        '--log-dir',
        default=None,
        help=(
            'Pasta onde o arquivo de log será gravado. '
            'Padrão: subpasta "logs/" no mesmo diretório do script.'
        ),
    )
    args = parser.parse_args()

    log_dir = Path(args.log_dir) if args.log_dir else _SCRIPT_DIR / "logs"

    asyncio.run(update_services_status(args.json_file, timeout=args.timeout, log_dir=log_dir))


if __name__ == "__main__":
    main()
