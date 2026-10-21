(() => {
  document.querySelectorAll('.admin-option-actions').forEach(group => {
    group.querySelectorAll('button[data-state]').forEach(button => {
      button.addEventListener('click', () => {
        group.querySelectorAll('button[data-state]').forEach(option => {
          const selected = option === button;
          option.setAttribute('aria-pressed', String(selected));
          option.classList.toggle('is-selected', selected);
        });
      });
    });
  });
})();
