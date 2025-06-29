# import csv
# import json
# import sys
# from datetime import datetime

# def contar_eventos_por_dia_semana(caminho_csv):
#     # Inicializa contadores para os dias da semana: 0 (segunda) até 6 (domingo)
#     contadores = [0] * 7

#     # Abre o arquivo CSV
#     with open(caminho_csv, newline='', encoding='utf-8') as csvfile:
#         leitor = csv.DictReader(csvfile, delimiter=';')
#         for linha in leitor:
#             try:
#                 # Converte o timestamp para objeto datetime
#                 data_evento = datetime.fromisoformat(linha['timestamp'].replace('Z', '+00:00'))
#                 dia_semana = data_evento.weekday()  # 0=segunda, 6=domingo
#                 contadores[dia_semana] += 1
#             except Exception as e:
#                 print(f"Erro ao processar linha: {linha}. Erro: {e}", file=sys.stderr)

#     # Imprime o resultado como JSON (array simples)
#     print(json.dumps(contadores))

# if __name__ == "__main__":
#     if len(sys.argv) != 2:
#         print("Uso: python count_events_by_weekday.py <caminho_para_arquivo_csv>")
#         sys.exit(1)

#     caminho_arquivo = sys.argv[1]
#     contar_eventos_por_dia_semana(caminho_arquivo)

import csv
import json
import sys
from datetime import datetime, timedelta

def contar_eventos_por_dia_semana(caminho_csv):
    # Nomes dos dias da semana abreviados
    nomes_dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

    # Data e hora atual
    agora = datetime.now()

    # Lista de dias da semana na ordem correta (terminando pelo dia atual)
    hoje = agora.weekday()  # 0 = segunda, ..., 6 = domingo
    ordem_dias = [(hoje - 6 + i) % 7 for i in range(7)]  # Últimos 7 dias, na ordem correta
    labels = [nomes_dias[i] for i in ordem_dias]

    # Inicializa contador por dia da semana
    contadores = {i: 0 for i in range(7)}

    # Limite inferior da janela de tempo (últimos 7 dias)
    sete_dias_atras = agora - timedelta(days=6)

    # Lê o CSV
    with open(caminho_csv, newline='', encoding='utf-8') as csvfile:
        leitor = csv.DictReader(csvfile, delimiter=';')
        for linha in leitor:
            try:
                data_evento = datetime.fromisoformat(linha['timestamp'].replace('Z', '+00:00'))

                # Considera apenas eventos nos últimos 7 dias (incluindo hoje)
                if sete_dias_atras.date() <= data_evento.date() <= agora.date():
                    dia_semana = data_evento.weekday()
                    contadores[dia_semana] += 1

            except Exception as e:
                print(f"Erro ao processar linha: {linha}. Erro: {e}", file=sys.stderr)

    # Reorganiza os dados conforme a ordem de labels
    data = [contadores[i] for i in ordem_dias]

    # Resultado final em JSON
    resultado = {
        "labels": labels,
        "data": data
    }
    print(json.dumps(resultado, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python count_events_by_weekday.py <caminho_para_arquivo_csv>")
        sys.exit(1)

    caminho_arquivo = sys.argv[1]
    contar_eventos_por_dia_semana(caminho_arquivo)
