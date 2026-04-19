#Version 2.0

import asyncio
import aiohttp
import json
import argparse
from urllib.parse import quote
from datetime import datetime, UTC
from pathlib import Path

# ---- Constantes de log ----
_SCRIPT_DIR  = Path(__file__).parent
_SCRIPT_NAME = Path(__file__).stem   # "check_status"
_MAX_LOG_SIZE = 500 * 1024           # 500 KB


def _write_log(message: str, log_dir: Path) -> None:
    """Grava uma linha de log no arquivo, rotacionando quando exceder 500 KB.

    Formato: YYYY-MM-DD HH:MM:SS: <mensagem>
    """
    log_dir.mkdir(parents=True, exist_ok=True)

    log_file = log_dir / f"{_SCRIPT_NAME}.log"

    # Rotaciona se o arquivo já existe e ultrapassou o tamanho máximo
    if log_file.exists() and log_file.stat().st_size >= _MAX_LOG_SIZE:
        old_file = log_dir / f"{_SCRIPT_NAME}_old.old"
        log_file.rename(old_file)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"{timestamp}: {message}\n")


async def _tcp_reachable(host: str, port: int, timeout) -> bool:
    """Returns True if a TCP connection can be established to host:port."""
    try:
        timeout_secs = timeout.total if hasattr(timeout, 'total') else float(timeout)
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout_secs,
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


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

    except aiohttp.ClientResponseError as e:
        # Server responded but with non-HTTP framing (e.g. raw "Unauthorized").
        # Fall back to TCP probe: if the port is open the service is up.
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        reachable = await _tcp_reachable(host, port, timeout)
        if reachable:
            print(f"URL: {url}: resposta não-HTTP recebida ({type(e).__name__}), TCP online")
            return "online"
        print(f"URL: {url}: resposta não-HTTP e TCP falhou ({type(e).__name__})")
        return "offline"

    except Exception as e:
        print(f"Erro ao verificar {url}: {type(e).__name__} - {e}")
        return "offline"

async def update_services_status(filepath, timeout=5, log_dir: Path = None):
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
        await send_notification(data['notificationHook'], service, log_dir=log_dir)

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

async def send_notification(notificationHook, service, log_dir: Path = None):
    """
    Envia notificação para endpoint local conforme o modo configurado em 'notificationHookMode'.

    Modos disponíveis:
    - "off"          : Nunca envia notificação.
    - "when-online"  : Envia notificação quando o serviço ficar online (apenas na transição).
    - "when-offline" : Envia notificação quando o serviço ficar offline (apenas na transição).

    Campos do serviço utilizados:
    - name            : nome do serviço
    - url             : endereço do serviço monitorado
    - status          : status atual ("online" ou "offline")
    - notificationHookMode : modo de notificação (padrão: "when-offline")
    - lastStatusOnline  : última data/hora que foi online
    - lastStatusOffline : última data/hora que foi offline
    """

    if notificationHook == '':
        return

    mode = service.get('notificationHookMode', 'when-offline')

    # Modo desligado: não faz nada
    if mode == 'off':
        return

    name    = service.get('name') or service.get('url')
    url     = service.get('url')
    status  = service.get('status')
    lastStatusOnline  = service.get('lastStatusOnline')
    lastStatusOffline = service.get('lastStatusOffline')

    if mode == 'when-offline':
        # Só notifica se o status atual for "offline"
        if status != 'offline':
            return

        # Evita reenvio: só dispara se lastStatusOffline NÃO for mais recente que lastStatusOnline
        # (ou seja, é uma nova queda, não uma queda já conhecida)
        if lastStatusOffline and (not lastStatusOnline or lastStatusOffline > lastStatusOnline):
            return

    elif mode == 'when-online':
        # Só notifica se o status atual for "online"
        if status != 'online':
            return

        # Evita reenvio: só dispara se lastStatusOnline NÃO for mais recente que lastStatusOffline
        # (ou seja, é uma nova recuperação, não uma online já conhecida)
        if lastStatusOnline and (not lastStatusOffline or lastStatusOnline > lastStatusOffline):
            return

    else:
        msg = f"notificationHookMode desconhecido: '{mode}'. Notificação ignorada para {name}."
        print(msg)
        if log_dir is not None:
            _write_log(msg, log_dir)
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
                    msg = f"🔔 Notificação enviada com sucesso para {name} ({url})"
                    print(msg)
                    if log_dir is not None:
                        _write_log(msg, log_dir)
                else:
                    msg = f"⚠️ Falha ao enviar notificação ({response.status}) para {name}"
                    print(msg)
                    if log_dir is not None:
                        _write_log(msg, log_dir)
    except Exception as e:
        msg = f"Erro ao enviar notificação para {name} ({url}): {type(e).__name__} - {e}"
        print(msg)
        if log_dir is not None:
            _write_log(msg, log_dir)

def main():
    parser = argparse.ArgumentParser(description="Verifica múltiplos serviços HTTP definidos em um JSON")
    parser.add_argument('json_file', help='Caminho para o arquivo JSON com as URLs a verificar')
    parser.add_argument('--timeout', type=int, default=5, help='Tempo limite das requisições (padrão: 5s)')
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