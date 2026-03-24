/* ================================================
   DRAWER — Lógica de toggle e carregamento de versão
   ================================================ */

(function () {
  const STORAGE_KEY = 'drawer_expanded';

  const drawer    = document.getElementById('side-drawer');
  const toggleBtn = document.getElementById('drawer-toggle');
  const overlay   = document.getElementById('drawer-overlay');

  // ── Restaurar estado salvo ──
  const savedState = localStorage.getItem(STORAGE_KEY);
  const isDesktop  = window.innerWidth > 768;

  if (savedState === 'true' && isDesktop) {
    openDrawer(false);
  }

  // ── Toggle pelo botão hambúrguer / fechar ──
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    drawer.classList.contains('expanded') ? closeDrawer() : openDrawer();
  });

  // ── Clicar na área vazia do drawer recolhido → expande ──
  // Captura cliques no próprio drawer que não sejam em elementos interativos
  drawer.addEventListener('click', (e) => {
    if (drawer.classList.contains('expanded')) return; // já expandido, nada a fazer aqui
    if (e.target === toggleBtn || toggleBtn.contains(e.target)) return; // delegado ao toggleBtn

    // Verifica se o clique foi em (ou dentro de) um .drawer-item com ação associada
    const actionItem = e.target.closest('.add-card-item');
    if (actionItem) {
      // Trata botões de ação abaixo — não precisa só expandir
      return;
    }

    // Área vazia (header, divider, nav background, footer): apenas expande
    openDrawer();
  });

  // ── Botões de ação funcionam mesmo com o drawer recolhido ──
  // Ao clicar no ícone de qualquer .add-card-item recolhido, expande + dispara a ação
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.add-card-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (drawer.classList.contains('expanded')) return; // expandido: o trigger interno cuida

        e.stopPropagation();

        // Descobre o botão de ação associado dentro deste item
        const trigger = item.querySelector('.add-card-trigger');
        if (!trigger) return;

        openDrawer();
        // Aguarda a transição de abertura antes de disparar o botão
        setTimeout(() => trigger.click(), 280);
      });
    });

    // Carregar versão da aplicação
    loadVersion();
  });

  // ── Fechar ao clicar no overlay (mobile) ──
  overlay.addEventListener('click', () => {
    closeDrawer();
  });

  // ── ESC: fecha drawer se expandido e nenhum modal/edição estiver aberto ──
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!drawer.classList.contains('expanded')) return;

    // Se estiver em mobile, fecha sempre (overlay ativo)
    if (window.innerWidth <= 768) {
      closeDrawer();
      return;
    }

    // Desktop: só fecha se nenhum modal estiver visível
    const anyModalOpen = document.querySelector('.modal.show');
    if (anyModalOpen) return;

    closeDrawer();
  });

  // ── Reajustar ao redimensionar ──
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      overlay.classList.toggle('visible', drawer.classList.contains('expanded'));
    } else {
      overlay.classList.remove('visible');
    }
  });

  // ── Funções de abrir / fechar ──
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

  // ── Carregar versão ──
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
})();