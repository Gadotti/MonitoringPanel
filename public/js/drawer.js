/* ================================================
   DRAWER — Lógica de toggle e carregamento de versão
   ================================================ */

(function () {
  const STORAGE_KEY = 'drawer_expanded';

  const drawer = document.getElementById('side-drawer');
  const toggleBtn = document.getElementById('drawer-toggle');
  const overlay = document.getElementById('drawer-overlay');

  // Restaurar estado salvo
  const savedState = localStorage.getItem(STORAGE_KEY);
  const isDesktop = window.innerWidth > 768;

  if (savedState === 'true' && isDesktop) {
    openDrawer(false);
  }

  // Toggle ao clicar no botão
  toggleBtn.addEventListener('click', () => {
    if (drawer.classList.contains('expanded')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  // Fechar ao clicar no overlay (mobile)
  overlay.addEventListener('click', () => {
    closeDrawer();
  });

  function openDrawer(animate = true) {
    drawer.classList.add('expanded');
    document.body.classList.add('drawer-expanded');

    if (window.innerWidth <= 768) {
      overlay.classList.add('visible');
    }

    localStorage.setItem(STORAGE_KEY, 'true');
  }

  function closeDrawer() {
    drawer.classList.remove('expanded');
    document.body.classList.remove('drawer-expanded');
    overlay.classList.remove('visible');
    localStorage.setItem(STORAGE_KEY, 'false');
  }

  // Fechar com Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('expanded') && window.innerWidth <= 768) {
      closeDrawer();
    }
  });

  // Reajustar ao redimensionar
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      overlay.classList.toggle('visible', drawer.classList.contains('expanded'));
    } else {
      overlay.classList.remove('visible');
    }
  });

  // Carregar versão da aplicação
  async function loadVersion() {
    try {
      const res = await fetch('/version');
      if (!res.ok) return;
      const data = await res.json();
      const versionEl = document.getElementById('app-version');
      if (versionEl && data.version) {
        versionEl.textContent = data.version;
      }
    } catch (err) {
      console.warn('Não foi possível carregar a versão:', err);
    }
  }

  // Clique no ícone do add-card quando drawer recolhido → expande + abre modal
  document.addEventListener('DOMContentLoaded', () => {
    const addCardIcon = document.querySelector('.add-card-icon');
    if (addCardIcon) {
      addCardIcon.addEventListener('click', () => {
        if (!drawer.classList.contains('expanded')) {
          openDrawer();
          setTimeout(() => {
            document.getElementById('btn-new-card')?.click();
          }, 280);
        }
      });
    }
  });

  document.addEventListener('DOMContentLoaded', loadVersion);
})();