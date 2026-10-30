const mongoose = require('mongoose');

const aulaSchema = new mongoose.Schema({
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', required: true },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', default: null },
  dia: { type: Number, required: true, min: 0, max: 6 },
  hora: { type: Number, required: true, min: 7, max: 22 }
}, { timestamps: false });

const gradeHorarioSchema = new mongoose.Schema({
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
  semestre: { type: Number, required: true, min: 1, max: 20 },
  aulas: { type: [aulaSchema], default: [] }
}, { timestamps: true, collection: 'grades_horarios' });

gradeHorarioSchema.index({ cursoId: 1, semestre: 1 }, { unique: true });

module.exports = mongoose.models.GradeHorario || mongoose.model('GradeHorario', gradeHorarioSchema);
