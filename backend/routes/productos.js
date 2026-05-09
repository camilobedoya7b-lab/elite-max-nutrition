const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Obtener todos los productos activos
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM productos WHERE activo = true ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
});

// Crear producto (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, categoria, precio, unidad } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO productos (nombre, categoria, precio, unidad) VALUES ($1,$2,$3,$4) RETURNING *',
      [nombre, categoria, precio, unidad]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creando producto' });
  }
});

// Editar producto (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, categoria, precio, unidad, activo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE productos SET nombre=$1, categoria=$2, precio=$3, unidad=$4, activo=$5 WHERE id=$6 RETURNING *',
      [nombre, categoria, precio, unidad, activo, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando producto' });
  }
});

module.exports = router;