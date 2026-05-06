const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Ver meta del asesor actual (o de todos si es admin)
router.get('/', verificarToken, async (req, res) => {
  const mes = new Date().getMonth() + 1;
  const año = new Date().getFullYear();

  try {
    let query = `
      SELECT m.*, u.nombre as asesor_nombre,
        COALESCE(SUM(p.total), 0) as vendido
      FROM metas m
      JOIN usuarios u ON m.asesor_id = u.id
      LEFT JOIN pedidos p ON p.asesor_id = m.asesor_id
        AND EXTRACT(MONTH FROM p.fecha) = m.mes
        AND EXTRACT(YEAR FROM p.fecha) = m.año
        AND p.estado = 'Entregado'
      WHERE m.mes = $1 AND m.año = $2
    `;

    const params = [mes, año];

    if (req.usuario.rol === 'asesor') {
      query += ' AND m.asesor_id = $3';
      params.push(req.usuario.id);
    }

    query += ' GROUP BY m.id, u.nombre';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo metas' });
  }
});

// Crear o actualizar meta (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  const { asesor_id, meta, mes, año } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO metas (asesor_id, mes, año, meta, creado_por)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (asesor_id, mes, año)
       DO UPDATE SET meta = $4 RETURNING *`,
      [asesor_id, mes, año, meta, req.usuario.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error guardando meta' });
  }
});

module.exports = router;