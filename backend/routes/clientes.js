const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Obtener todos los clientes
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
});

// Crear cliente (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, telefono, ciudad, direccion, descuento } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO clientes (nombre, telefono, ciudad, direccion, descuento) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nombre, telefono, ciudad, direccion, descuento || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creando cliente' });
  }
});

// Editar cliente (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  const { nombre, telefono, ciudad, direccion, descuento } = req.body;
  try {
    const result = await pool.query(
      'UPDATE clientes SET nombre=$1, telefono=$2, ciudad=$3, direccion=$4, descuento=$5 WHERE id=$6 RETURNING *',
      [nombre, telefono, ciudad, direccion, descuento, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
});

module.exports = router;