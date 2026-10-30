const mongoose = require('mongoose');

const turmaSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  cursoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Curso',
    required: true
  },
  periodoLetivo: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  vagas: {
    type: Number,
    required: true,
    min: 1,
    max: 300
  },
  semestreOrganizacao: { type: Number, min: 1, max: 20, default: null },
  horarios: [{
    gradeHorarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'GradeHorario', required: true },
    aulaId: { type: mongoose.Schema.Types.ObjectId, required: true },
    disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
    docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', required: true },
    dia: { type: Number, required: true, min: 0, max: 6 },
    hora: { type: Number, required: true, min: 7, max: 22 },
    semestre: { type: Number, required: true, min: 1, max: 20 }
  }]
}, { timestamps: true, collection: 'turmas' });

module.exports = mongoose.models.Turma || mongoose.model('Turma', turmaSchema);
