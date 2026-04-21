(function () {
  const btn = document.getElementById('btn-backup');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const label = btn.querySelector('.add-card-label');
    const originalText = label.textContent;
    label.textContent = 'Gerando backup…';

    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
    } finally {
      label.textContent = originalText;
      btn.disabled = false;
    }
  });
})();
