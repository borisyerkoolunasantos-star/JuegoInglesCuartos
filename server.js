const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── Estado global ────────────────────────────────────────────────────────────
let session = {
  active: false,
  code: null,
  config: { numPreguntas: 10, tiempoPorPregunta: 25, tipo: 'mixed', nombreDocente: '' },
  preguntas: [],
  estudiantes: {},
  started: false,
  teacherSocketId: null
};

// ─── Banco de preguntas "Be Going To" ─────────────────────────────────────────
const SUJETOS = [
  { sujeto: 'They', aux: 'are', pronombre: 'they' },
  { sujeto: 'He', aux: 'is', pronombre: 'he' },
  { sujeto: 'She', aux: 'is', pronombre: 'she' },
  { sujeto: 'Tom', aux: 'is', pronombre: 'he' },
  { sujeto: 'Sam', aux: 'is', pronombre: 'he' },
  { sujeto: 'We', aux: 'are', pronombre: 'we' },
  { sujeto: 'I', aux: 'am', pronombre: 'I' },
  { sujeto: 'You', aux: 'are', pronombre: 'you' },
  { sujeto: 'Jane', aux: 'is', pronombre: 'she' },
  { sujeto: 'My father', aux: 'is', pronombre: 'he' },
  { sujeto: 'The children', aux: 'are', pronombre: 'they' },
  { sujeto: 'Ayse', aux: 'is', pronombre: 'she' },
  { sujeto: 'Henry', aux: 'is', pronombre: 'he' },
  { sujeto: 'Paul', aux: 'is', pronombre: 'he' },
  { sujeto: 'Martha', aux: 'is', pronombre: 'she' },
  { sujeto: 'Gloria', aux: 'is', pronombre: 'she' },
  { sujeto: 'Robert', aux: 'is', pronombre: 'he' },
  { sujeto: 'Willy', aux: 'is', pronombre: 'he' },
  { sujeto: 'John', aux: 'is', pronombre: 'he' },
  { sujeto: 'Young girls', aux: 'are', pronombre: 'they' },
];

const ACTIVIDADES = [
  { verbo: 'travel', actividad: 'travel by motorbike', tiempo: 'tomorrow', emoji: '🏍️' },
  { verbo: 'make', actividad: 'make a cake', tiempo: 'next week', emoji: '🎂' },
  { verbo: 'search', actividad: 'search his homework on the net', tiempo: 'tonight', emoji: '💻' },
  { verbo: 'visit', actividad: 'visit Istanbul', tiempo: 'next summer', emoji: '🌍' },
  { verbo: 'marry', actividad: 'get married', tiempo: 'next month', emoji: '💍' },
  { verbo: 'call', actividad: 'call the teacher', tiempo: 'tonight', emoji: '📞' },
  { verbo: 'have', actividad: 'have a picnic', tiempo: 'next weekend', emoji: '🧺' },
  { verbo: 'graduate', actividad: 'graduate', tiempo: 'next year', emoji: '🎓' },
  { verbo: 'read', actividad: 'read magazines', tiempo: 'tonight', emoji: '📖' },
  { verbo: 'take', actividad: 'take some photos', tiempo: 'this afternoon', emoji: '📸' },
  { verbo: 'do', actividad: 'do exercises', tiempo: 'in the morning', emoji: '🏋️' },
  { verbo: 'play', actividad: 'play baseball', tiempo: 'next weekend', emoji: '⚾' },
  { verbo: 'ride', actividad: 'ride a bike', tiempo: 'this afternoon', emoji: '🚲' },
  { verbo: 'plant', actividad: 'plant flowers', tiempo: 'next week', emoji: '🌸' },
  { verbo: 'become', actividad: 'become a famous pop star', tiempo: 'someday', emoji: '⭐' },
  { verbo: 'study', actividad: 'study for the exam', tiempo: 'tomorrow', emoji: '📚' },
  { verbo: 'swim', actividad: 'swim in the pool', tiempo: 'next weekend', emoji: '🏊' },
  { verbo: 'score', actividad: 'score some goals', tiempo: 'in the match', emoji: '⚽' },
  { verbo: 'kick', actividad: 'kick the ball', tiempo: 'in the game', emoji: '🦵' },
  { verbo: 'bake', actividad: 'bake cookies', tiempo: 'this Sunday', emoji: '🍪' },
  { verbo: 'watch', actividad: 'watch a movie', tiempo: 'tonight', emoji: '🎬' },
  { verbo: 'cook', actividad: 'cook dinner', tiempo: 'this evening', emoji: '🍳' },
  { verbo: 'go', actividad: 'go shopping', tiempo: 'tomorrow', emoji: '🛍️' },
  { verbo: 'clean', actividad: 'clean the house', tiempo: 'this weekend', emoji: '🧹' },
  { verbo: 'paint', actividad: 'paint a picture', tiempo: 'next Saturday', emoji: '🎨' },
  { verbo: 'sing', actividad: 'sing at the concert', tiempo: 'next Friday', emoji: '🎤' },
  { verbo: 'open', actividad: 'open the presents', tiempo: 'on her birthday', emoji: '🎁' },
  { verbo: 'phone', actividad: 'phone her friend', tiempo: 'this evening', emoji: '📱' },
  { verbo: 'peel', actividad: 'peel an orange', tiempo: 'for breakfast', emoji: '🍊' },
  { verbo: 'learn', actividad: 'learn some English', tiempo: 'this year', emoji: '🇬🇧' },
];

const AUXILIARES = ['am', 'is', 'are'];

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function getRandom(arr, exclude = [], count = 3) {
  return shuffle(arr.filter(x => !exclude.includes(x))).slice(0, count);
}

function generarPregunta(sujeto, actividad, tipo) {
  const correctaAux = sujeto.aux;
  const correctaVerbo = actividad.verbo;
  const oracionCompleta = `${sujeto.sujeto} ${sujeto.aux} going to ${actividad.actividad} ${actividad.tiempo}.`;

  if (tipo === 'auxiliar') {
    // ¿Qué auxiliar va con el sujeto?
    const distractor = AUXILIARES.filter(a => a !== correctaAux);
    return {
      tipo: 'opcion',
      enunciado: `Choose the correct auxiliary verb for: <strong>"${sujeto.sujeto} ___ going to ${actividad.verbo}..."</strong>`,
      opciones: shuffle([correctaAux, ...distractor]),
      correcta: correctaAux,
      emoji: actividad.emoji,
      tip: `With <strong>${sujeto.sujeto}</strong>, we use <strong>"${sujeto.aux}"</strong> → ${sujeto.sujeto} <strong>${sujeto.aux}</strong> going to...`,
      categoria: 'Auxiliary Verb'
    };
  }

  if (tipo === 'completacion') {
    // Completar el espacio en blanco
    const otrosVerbos = getRandom(ACTIVIDADES.map(a => a.verbo).filter(v => v !== correctaVerbo), [], 3);
    return {
      tipo: 'opcion',
      enunciado: `Complete the sentence: <strong>"${sujeto.sujeto} ${sujeto.aux} going to ___ ${actividad.tiempo}."</strong>`,
      opciones: shuffle([correctaVerbo, ...otrosVerbos]),
      correcta: correctaVerbo,
      emoji: actividad.emoji,
      tip: `The complete sentence: <em>${oracionCompleta}</em>`,
      categoria: 'Fill in the Blank'
    };
  }

  if (tipo === 'estructura') {
    // Identificar la estructura correcta
    const sujetoStr = sujeto.sujeto;
    const opCorrecta = `${sujetoStr} ${sujeto.aux} going to ${actividad.verbo}`;
    const otro1 = `${sujetoStr} ${shuffle(AUXILIARES.filter(a=>a!==sujeto.aux))[0]} going to ${actividad.verbo}`;
    const otro2 = `${sujetoStr} ${sujeto.aux} going to ${shuffle(ACTIVIDADES.filter(a=>a.verbo!==actividad.verbo))[0].verbo}`;
    const otro3 = `${sujetoStr} will ${actividad.verbo}`;
    return {
      tipo: 'opcion',
      enunciado: `Which sentence is grammatically CORRECT? (${actividad.emoji} ${actividad.actividad})`,
      opciones: shuffle([opCorrecta, otro1, otro2, otro3]),
      correcta: opCorrecta,
      emoji: '✅',
      tip: `Structure: <strong>Subject + am/is/are + going to + verb</strong><br>→ ${oracionCompleta}`,
      categoria: 'Grammar Structure'
    };
  }

  if (tipo === 'negativa') {
    // Forma negativa
    const correctaNeg = `${sujeto.sujeto} ${sujeto.aux} not going to ${actividad.verbo}`;
    const otro1 = `${sujeto.sujeto} not ${sujeto.aux} going to ${actividad.verbo}`;
    const otro2 = `${sujeto.sujeto} ${sujeto.aux} going to not ${actividad.verbo}`;
    const otro3 = `${sujeto.sujeto} don't going to ${actividad.verbo}`;
    return {
      tipo: 'opcion',
      enunciado: `Make it NEGATIVE: <strong>"${sujeto.sujeto} ${sujeto.aux} going to ${actividad.verbo}..."</strong>`,
      opciones: shuffle([correctaNeg, otro1, otro2, otro3]),
      correcta: correctaNeg,
      emoji: '🚫',
      tip: `Negative: <strong>Subject + am/is/are + NOT + going to + verb</strong><br>→ ${correctaNeg} ${actividad.tiempo}.`,
      categoria: 'Negative Form'
    };
  }

  if (tipo === 'traduccion') {
    // Identificar la traducción (en español)
    const traducciones = {
      'travel': 'viajar', 'make': 'hacer', 'search': 'buscar', 'visit': 'visitar',
      'marry': 'casarse', 'call': 'llamar', 'have': 'tener/hacer', 'graduate': 'graduarse',
      'read': 'leer', 'take': 'tomar/sacar', 'do': 'hacer', 'play': 'jugar',
      'ride': 'montar', 'plant': 'plantar', 'become': 'convertirse', 'study': 'estudiar',
      'swim': 'nadar', 'score': 'anotar', 'kick': 'patear', 'bake': 'hornear',
      'watch': 'ver/mirar', 'cook': 'cocinar', 'go': 'ir', 'clean': 'limpiar',
      'paint': 'pintar', 'sing': 'cantar', 'open': 'abrir', 'phone': 'llamar por teléfono',
      'peel': 'pelar', 'learn': 'aprender'
    };
    const correctaTrad = traducciones[actividad.verbo] || actividad.verbo;
    const otrasTrads = shuffle(Object.entries(traducciones).filter(([k]) => k !== actividad.verbo)).slice(0,3).map(([,v])=>v);
    return {
      tipo: 'opcion',
      enunciado: `${actividad.emoji} What does <strong>"to ${actividad.verbo}"</strong> mean in Spanish?`,
      opciones: shuffle([correctaTrad, ...otrasTrads]),
      correcta: correctaTrad,
      emoji: '🇪🇸',
      tip: `"to ${actividad.verbo}" = <strong>${correctaTrad}</strong> en español.`,
      categoria: 'Vocabulary'
    };
  }

  // mixed → default a completacion
  return generarPregunta(sujeto, actividad, 'completacion');
}

function generarPreguntas(n, tipo) {
  const tipos = ['auxiliar', 'completacion', 'estructura', 'negativa', 'traduccion'];
  const combinaciones = [];
  for (const s of shuffle(SUJETOS)) {
    for (const a of shuffle(ACTIVIDADES)) {
      combinaciones.push({ s, a });
    }
  }
  return shuffle(combinaciones).slice(0, Math.min(n, combinaciones.length)).map(({ s, a }, i) => {
    const t = tipo === 'mixed' ? tipos[i % tipos.length] : tipo;
    return generarPregunta(s, a, t);
  });
}

// ─── Exportar Excel ────────────────────────────────────────────────────────────
app.get('/exportar-excel', (req, res) => {
  const rows = [['Nombre', 'Paralelo', 'Edad', 'Puntaje', 'Correctas', 'Incorrectas', 'Calificación %', 'Estado']];
  Object.values(session.estudiantes).forEach(e => {
    const total = session.preguntas.length || 1;
    const pct = Math.round((e.correctas / total) * 100);
    rows.push([e.nombre, e.paralelo, e.edad, e.puntaje, e.correctas, e.incorrectas, pct + '%', e.terminado ? 'Terminó' : 'En curso']);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:20},{wch:12},{wch:8},{wch:10},{wch:12},{wch:14},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=resultados_english.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.get('/exportar-txt', (req, res) => {
  let txt = `==========================================\n`;
  txt += `   RESULTADOS - BE GOING TO ENGLISH GAME\n`;
  txt += `   Docente: ${session.config.nombreDocente}\n`;
  txt += `   Fecha: ${new Date().toLocaleString('es')}\n`;
  txt += `==========================================\n\n`;
  const sorted = Object.values(session.estudiantes).sort((a,b) => b.puntaje - a.puntaje);
  sorted.forEach((e, i) => {
    const total = session.preguntas.length || 1;
    const pct = Math.round((e.correctas / total) * 100);
    txt += `${i+1}. ${e.nombre}\n`;
    txt += `   Paralelo: ${e.paralelo} | Edad: ${e.edad} años\n`;
    txt += `   Puntaje: ${e.puntaje} pts | Correctas: ${e.correctas}/${total}\n`;
    txt += `   Calificación: ${pct}%\n\n`;
  });
  res.setHeader('Content-Disposition', 'attachment; filename=resultados_english.txt');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(txt);
});

// ─── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/docente', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docente.html')));
app.get('/alumno', (req, res) => res.sendFile(path.join(__dirname, 'public', 'alumno.html')));

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('docente:crear_sesion', (config) => {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    session = {
      active: true, code: codigo, config,
      preguntas: [], estudiantes: {}, started: false,
      teacherSocketId: socket.id
    };
    socket.join('docente');
    socket.emit('docente:sesion_creada', { codigo });
  });

  socket.on('docente:iniciar_juego', () => {
    if (!session.active) return;
    session.preguntas = generarPreguntas(session.config.numPreguntas, session.config.tipo);
    session.started = true;
    const preguntasSinRespuesta = session.preguntas.map(({ correcta, ...rest }) => rest);
    io.to('alumnos').emit('juego:iniciar', {
      preguntas: preguntasSinRespuesta,
      tiempoPorPregunta: session.config.tiempoPorPregunta
    });
    socket.emit('docente:juego_iniciado', { numPreguntas: session.preguntas.length });
  });

  socket.on('docente:reiniciar', () => {
    session.estudiantes = {};
    session.started = false;
    session.preguntas = [];
    io.to('alumnos').emit('juego:reiniciado');
    socket.emit('docente:reiniciado');
  });

  socket.on('alumno:unirse', ({ nombre, paralelo, edad, codigo }) => {
    if (!session.active || session.code !== codigo) {
      socket.emit('alumno:error', 'Código incorrecto o sin sesión activa.');
      return;
    }
    if (session.started) {
      socket.emit('alumno:error', 'El juego ya comenzó. Espera la próxima sesión.');
      return;
    }
    session.estudiantes[socket.id] = {
      nombre, paralelo, edad: parseInt(edad),
      puntaje: 0, correctas: 0, incorrectas: 0,
      respuestas: [], terminado: false, socketId: socket.id
    };
    socket.join('alumnos');
    socket.emit('alumno:unido', { nombre });
    io.to('docente').emit('docente:nuevo_alumno', {
      id: socket.id, nombre, paralelo, edad,
      total: Object.keys(session.estudiantes).length
    });
  });

  socket.on('alumno:responder', ({ preguntaIdx, respuesta, tiempoUsado }) => {
    const est = session.estudiantes[socket.id];
    if (!est) return;
    const pregunta = session.preguntas[preguntaIdx];
    if (!pregunta) return;

    const esCorrecta = respuesta === pregunta.correcta;
    const tiempoMax = session.config.tiempoPorPregunta;
    const bonus = esCorrecta ? Math.round(((tiempoMax - tiempoUsado) / tiempoMax) * 10) : 0;
    const puntos = esCorrecta ? 10 + bonus : 0;

    est.puntaje += puntos;
    if (esCorrecta) est.correctas++; else est.incorrectas++;
    est.respuestas.push({ preguntaIdx, respuesta, esCorrecta, puntos });

    socket.emit('alumno:feedback', {
      esCorrecta,
      correcta: pregunta.correcta,
      puntos,
      tip: pregunta.tip
    });

    io.to('docente').emit('docente:respuesta_alumno', {
      id: socket.id,
      nombre: est.nombre,
      preguntaIdx,
      esCorrecta,
      puntaje: est.puntaje,
      correctas: est.correctas,
      incorrectas: est.incorrectas
    });
  });

  socket.on('alumno:termino', () => {
    const est = session.estudiantes[socket.id];
    if (!est) return;
    est.terminado = true;
    const total = session.preguntas.length;
    const pct = Math.round((est.correctas / total) * 100);
    io.to('docente').emit('docente:alumno_termino', {
      id: socket.id, nombre: est.nombre, paralelo: est.paralelo,
      puntaje: est.puntaje, correctas: est.correctas, incorrectas: est.incorrectas,
      pct, terminados: Object.values(session.estudiantes).filter(e=>e.terminado).length,
      total: Object.keys(session.estudiantes).length
    });
  });

  socket.on('disconnect', () => {
    if (session.estudiantes[socket.id]) {
      const nombre = session.estudiantes[socket.id].nombre;
      delete session.estudiantes[socket.id];
      io.to('docente').emit('docente:alumno_desconectado', { id: socket.id, nombre });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
