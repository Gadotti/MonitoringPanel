(function () {
  const btn = document.getElementById('btn-backup');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.disabled = true;
    const originalLabel = btn.querySelector('.add-card-label');
    const originalText = originalLabel.textContent;
    originalLabel.textContent = 'Gerando backup…';

    window.location.href = '/api/backup';

    setTimeout(() => {
      originalLabel.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  });
})();
