(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!host) return;

  const isStudent = app.dataset.role === 'aluno';
  host.classList.remove('card');
  host.classList.add('profile-host');

  const personalFields = isStudent
    ? `
      <label class="profile-field">
        <span>Nome Completo</span>
        <input type="text" placeholder="Nome completo" readonly aria-readonly="true">
      </label>
      <label class="profile-field">
        <span>E-mail Institucional</span>
        <input type="email" placeholder="E-mail institucional" readonly aria-readonly="true">
      </label>
      <label class="profile-field">
        <span>Documento (CPF)</span>
        <input type="text" placeholder="Documento cadastrado" readonly aria-readonly="true">
      </label>
      <label class="profile-field">
        <span>Celular</span>
        <input type="tel" placeholder="(00) 00000-0000">
      </label>
      <label class="profile-field">
        <span>Endere&ccedil;o</span>
        <input type="text" placeholder="Endere&ccedil;o cadastrado" readonly aria-readonly="true">
      </label>
    `
    : `
      <div class="profile-fields-grid">
        <label class="profile-field">
          <span>Nome Completo</span>
          <input type="text" placeholder="Nome completo" readonly aria-readonly="true">
        </label>
        <label class="profile-field">
          <span>E-mail Institucional</span>
          <input type="email" placeholder="E-mail institucional" readonly aria-readonly="true">
        </label>
        <label class="profile-field">
          <span>Celular</span>
          <input type="tel" placeholder="(00) 00000-0000">
        </label>
        <label class="profile-field">
          <span>Documento (CPF)</span>
          <input type="text" inputmode="numeric" placeholder="Documento cadastrado" readonly aria-readonly="true">
        </label>
      </div>
      <label class="profile-field">
        <span>Endere&ccedil;o Residencial</span>
        <input type="text" placeholder="Endere&ccedil;o cadastrado" readonly aria-readonly="true">
      </label>
      <label class="profile-field">
        <span>Descri&ccedil;&atilde;o / Bio</span>
        <textarea rows="3" placeholder="Conte um pouco sobre sua atua&ccedil;&atilde;o acad&ecirc;mica"></textarea>
      </label>
      <div class="profile-fields-grid">
        <label class="profile-field">
          <span>Categoria de Contrata&ccedil;&atilde;o</span>
          <input type="text" placeholder="Categoria cadastrada" readonly aria-readonly="true">
        </label>
        <label class="profile-field">
          <span>Departamento</span>
          <input type="text" placeholder="Departamento cadastrado" readonly aria-readonly="true">
        </label>
      </div>
    `;

  host.innerHTML = `
    <div class="profile-layout ${isStudent ? 'student-profile' : 'professor-profile'}">
      <section class="profile-card profile-personal">
        <h2>Informa&ccedil;&otilde;es Pessoais</h2>
        <div class="profile-avatar-row">
          <div class="profile-avatar" aria-label="Foto de perfil vazia">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="22" r="12" fill="currentColor" opacity=".75"/>
              <path d="M10 58c1-13 10-21 22-21s21 8 22 21" fill="currentColor" opacity=".55"/>
            </svg>
          </div>
          <div class="profile-upload-area">
            <button class="profile-upload" type="button">${isStudent ? 'Alterar Foto' : 'Upload Nova Foto'}</button>
            <small>JPG, PNG ou GIF. M&aacute;ximo de 5 MB.</small>
          </div>
        </div>
        <div class="profile-fields">${personalFields}</div>
        <div class="profile-save-row">
          <button class="profile-save" type="button">Salvar Altera&ccedil;&otilde;es</button>
        </div>
      </section>

      <div class="profile-side-column">
        <section class="profile-card profile-security">
          <h2>${isStudent ? 'Seguran&ccedil;a e Acesso' : 'Seguran&ccedil;a &amp; Senha'}</h2>
          <div class="profile-fields">
            <label class="profile-field">
              <span>Senha Atual</span>
              <span class="profile-password-control">
                <input type="password" value="123456" readonly aria-readonly="true" autocomplete="current-password">
                <button class="password-visibility" type="button" data-password-toggle aria-label="Mostrar senha atual" aria-pressed="false" title="Mostrar senha">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m3 3 18 18"/></svg>
                </button>
              </span>
            </label>
            <label class="profile-field">
              <span>Nova Senha</span>
              <input type="password" placeholder="Digite a nova senha" autocomplete="new-password">
            </label>
            <label class="profile-field">
              <span>Confirmar Nova Senha</span>
              <input type="password" placeholder="Repita a nova senha" autocomplete="new-password">
            </label>
          </div>
          <button class="profile-security-save" type="button">${isStudent ? 'Alterar Senha de Acesso' : 'Alterar Senha'}</button>
        </section>
      </div>
    </div>
  `;

  host.querySelectorAll('[data-password-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(showPassword));
      button.setAttribute('aria-label', showPassword ? 'Ocultar senha atual' : 'Mostrar senha atual');
      button.title = showPassword ? 'Ocultar senha' : 'Mostrar senha';
    });
  });
})();
