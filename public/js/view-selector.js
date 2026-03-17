/* ================================================
   VIEW SELECTOR — Dropdown customizado
   Sincroniza com o <select id="view-selector"> via
   MutationObserver. Nenhum JS existente é alterado.
   ================================================ */

(function () {
  const hiddenSelect  = document.getElementById('view-selector');
  const wrapper       = document.getElementById('view-selector-wrapper');
  const trigger       = document.getElementById('view-selector-trigger');
  const label         = document.getElementById('view-selector-label');
  const dropdown      = document.getElementById('view-selector-dropdown');
  const drawer        = document.getElementById('side-drawer');

  if (!hiddenSelect || !trigger || !dropdown) return;

  /* ── Renderiza as opções no painel customizado ── */
  function renderOptions() {
    const options = Array.from(hiddenSelect.options);
    if (!options.length) return;

    dropdown.innerHTML = options.map(opt => `
      <button class="view-option" type="button" data-value="${opt.value}">
        <span class="view-option-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <span class="view-option-label">${opt.textContent}</span>
      </button>
    `).join('');

    dropdown.querySelectorAll('.view-option').forEach(btn => {
      btn.addEventListener('click', () => {
        hiddenSelect.value = btn.dataset.value;
        hiddenSelect.dispatchEvent(new Event('change'));
        closeDropdown();
      });
    });

    syncLabel();
  }

  /* ── Atualiza label e marca de seleção ── */
  function syncLabel() {
    const selected = hiddenSelect.options[hiddenSelect.selectedIndex];
    if (selected) label.textContent = selected.textContent;

    dropdown.querySelectorAll('.view-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.value === hiddenSelect.value);
    });
  }

  /* ── Observa quando o JS existente popula o <select> ── */
  const observer = new MutationObserver(renderOptions);
  observer.observe(hiddenSelect, { childList: true });

  /* Sincroniza label quando o valor muda via JS existente */
  hiddenSelect.addEventListener('change', syncLabel);

  /* ── Toggle do dropdown ── */
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();

    // Se o drawer está recolhido, expande primeiro
    if (!drawer.classList.contains('expanded')) {
      drawer.classList.add('expanded');
      document.body.classList.add('drawer-expanded');
      localStorage.setItem('drawer_expanded', 'true');
      // Abre o dropdown após a transição
      setTimeout(openDropdown, 260);
      return;
    }

    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });

  /* Clique no ícone quando recolhido → expande drawer */
  const icon = wrapper.querySelector('.view-selector-icon');
  if (icon) {
    icon.addEventListener('click', (e) => {
      if (!drawer.classList.contains('expanded')) {
        e.stopPropagation();
        drawer.classList.add('expanded');
        document.body.classList.add('drawer-expanded');
        localStorage.setItem('drawer_expanded', 'true');
        setTimeout(openDropdown, 260);
      }
    });
  }

  /* ── Fecha ao clicar fora ── */
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  });

  /* ── Fecha com Escape ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  function openDropdown() {
    dropdown.classList.add('open');
    trigger.classList.add('open');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    trigger.classList.remove('open');
  }
})();