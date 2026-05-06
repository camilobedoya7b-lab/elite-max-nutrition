const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Obtener todos los usuarios
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// Crear usuario
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { nombre, email, password, rol } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol',
      [nombre, email, password_hash, rol]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// Editar usuario
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { nombre, email, password, rol, activo } = req.body;
  try {
    let query, params;
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      query = 'UPDATE usuarios SET nombre=$1, email=$2, password_hash=$3, rol=$4, activo=$5 WHERE id=$6 RETURNING id, nombre, email, rol, activo';
      params = [nombre, email, password_hash, rol, activo, req.params.id];
    } else {
      query = 'UPDATE usuarios SET nombre=$1, email=$2, rol=$3, activo=$4 WHERE id=$5 RETURNING id, nombre, email, rol, activo';
      params = [nombre, email, rol, activo, req.params.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
});

module.exports = router;