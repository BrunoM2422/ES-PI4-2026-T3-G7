document.addEventListener('DOMContentLoaded', () => {
    NotaDezNotificacoes.iniciar({
        perfil: 'aluno',
        fontes: [NotaDezNotificacoes.fontes.calendario(), NotaDezNotificacoes.fontes.comunicados()]
    });
});
