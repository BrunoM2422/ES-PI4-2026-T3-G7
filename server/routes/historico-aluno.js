const express = require('express');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Turma = require('../models/Turma');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'aluno') {
    return res.status(403).json({ mensagem: 'Apenas alunos podem consultar o histórico escolar.' });
  }

  try {
    const identificadores = [{ email: req.usuario.email }];
    if (req.usuario.ra) identificadores.push({ ra: req.usuario.ra });
    const estudante = await Estudante.findOne({ $or: identificadores })
      .select('_id cursoId gradeMatriculas')
      .lean();

    if (!estudante) return res.status(404).json({ mensagem: 'Cadastro de aluno não encontrado.' });
    if (!estudante.cursoId) return res.status(409).json({ mensagem: 'Seu cadastro ainda não possui um curso vinculado.' });

    const idsMatriculas = (estudante.gradeMatriculas || []).map(item => String(item.disciplinaId));
    let idsMatriculadas = new Set(idsMatriculas);
    // Compatibilidade com matrículas antigas que só foram gravadas no array da turma.
    if (!idsMatriculas.length) {
      const turmasLegadas = await Turma.find({ alunosIds: estudante._id }).select('horarios.disciplinaId').lean();
      idsMatriculadas = new Set(turmasLegadas.flatMap(turma => (turma.horarios || [])
        .map(horario => String(horario.disciplinaId))));
    }

    const [curso, disciplinas] = await Promise.all([
      Curso.findById(estudante.cursoId).select('nome duracao').lean(),
      Disciplina.find({ $or: [
        { cursoId: estudante.cursoId },
        ...(idsMatriculadas.size ? [{ _id: { $in: [...idsMatriculadas] } }] : [])
      ] })
        .select('nome codigo semestre')
        .sort({ semestre: 1, codigo: 1 })
        .lean()
    ]);

    if (!curso) return res.status(409).json({ mensagem: 'O curso vinculado ao seu cadastro não foi encontrado.' });

    return res.json({
      curso: curso.nome,
      duracao: curso.duracao,
      disciplinas: disciplinas.map(disciplina => ({
        id: String(disciplina._id),
        nome: disciplina.nome,
        semestre: disciplina.semestre,
        mediaFinal: null,
        situacao: idsMatriculadas.has(String(disciplina._id)) ? 'matriculado' : 'nc'
      }))
    });
  } catch (erro) {
    console.error('Erro ao carregar histórico escolar:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar o histórico escolar.' });
  }
});

module.exports = router;
