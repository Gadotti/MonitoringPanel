function createChart(ctx, config) {
  return new Chart(ctx, config);
}

async function loadCardContentChart(card) {
  const chartElementId = `chart-${card.id}`;
  const chartElement = document.getElementById(chartElementId);

  if (chartElement && card.cardType === 'chart' && card.chart) {

    if (card.chart.data.datasets[0]?.script) {
      try {
        const response = await fetch('/api/chart-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptPath: card.chart.data.datasets[0].script,
            sourceFile: card.sourceItems
          })
        });

        if (!response.ok) throw new Error(`Erro ao processar dados para gráfico: ${response.status}`);

        const responseData = await response.json();
        const outputJson = JSON.parse(responseData.output);
        card.chart.data.datasets[0].data = outputJson.data;

        if (outputJson.labels) {
          card.chart.data.labels = outputJson.labels;
        }

      } catch (error) {
        console.error('Erro ao carregar eventos:', error);
      }
    }

    if (chartInstances[card.id]) {
      chartInstances[card.id].destroy();
      delete chartInstances[card.id];
    }

    const newChart = new Chart(chartElement, {
      type: card.chart.type,
      data: card.chart.data,
      options: card.chart.options || { responsive: true, maintainAspectRatio: false }
    });

    chartInstances[card.id] = newChart;
  }
}
