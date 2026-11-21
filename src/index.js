require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

const authRoutes       = require('./routes/auth');
const subjectRoutes    = require('./routes/subjects');
const lectTakerRoutes  = require('./routes/lectTaker');
const quizSolverRoutes = require('./routes/quizSolver');
const gdbSolverRoutes  = require('./routes/gdbSolver');

const app = express();
app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { res.status(500).json({ error: 'DB connection failed' }); }
});

app.use('/api/auth',        authRoutes);
app.use('/api/subjects',    subjectRoutes);
app.use('/api/lect-taker',  lectTakerRoutes);
app.use('/api/quiz-solver', quizSolverRoutes);
app.use('/api/gdb-solver',  gdbSolverRoutes);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

module.exports = app;
