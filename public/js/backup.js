(function () {
  const btn = document.getElementById('btn-backup');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.disabled = true;
    const originalLabel = btn.querySelector('.add-card-label');
    const originalText = originalLabel.textContent;
    originalLabel.textContent = 'Gerando backup…';

    const link = document.createElement('a');
    link.href = '/api/backup';
    link.download = 'backup.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      originalLabel.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  });
})();
