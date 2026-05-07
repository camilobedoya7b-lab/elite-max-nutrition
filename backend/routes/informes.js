const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken } = require('../middleware/auth');

// Informe por asesor (admin ve todos, asesor ve solo el suyo)
router.get('/por-asesor', verificarToken, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let query = `
      SELECT 
        u.id as asesor_id,
        u.nombre as asesor,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(p.total), 0) as total_ventas,
        COALESCE(SUM(CASE WHEN p.estado = 'Entregado' THEN p.total ELSE 0 END), 0) as ventas_entregadas,
        COUNT(CASE WHEN p.estado = 'Entregado' THEN 1 END) as pedidos_entregados,
        COUNT(CASE WHEN p.estado = 'Recibido' THEN 1 END) as pedidos_recibidos,
        COUNT(CASE WHEN p.estado = 'En preparacion' THEN 1 END) as pedidos_preparacion,
        COUNT(CASE WHEN p.estado = 'Despachado' THEN 1 END) as pedidos_despachados
      FROM usuarios u
      LEFT JOIN pedidos p ON p.asesor_id = u.id AND p.fecha BETWEEN $1 AND $2
      WHERE u.rol = 'asesor'
    `;
    const params = [desde, hasta];
    if (req.usuario.rol === 'asesor') {
      query += ` AND u.id = $3`;
      params.push(req.usuario.id);
    }
    query += ' GROUP BY u.id, u.nombre ORDER BY total_ventas DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando informe' });
  }
});

// Informe por producto
router.get('/por-producto', verificarToken, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let query = `
      SELECT 
        pr.codigo,
        pr.nombre as producto,
        pr.categoria,
        COALESCE(SUM(dp.cantidad), 0) as unidades_vendidas,
        COALESCE(SUM(dp.subtotal), 0) as total_ventas,
        COUNT(DISTINCT p.id) as pedidos
      FROM productos pr
      LEFT JOIN detalle_pedidos dp ON dp.producto_id = pr.id
      LEFT JOIN pedidos p ON dp.pedido_id = p.id AND p.fecha BETWEEN $1 AND $2
    `;
    const params = [desde, hasta];
    if (req.usuario.rol === 'asesor') {
      query += ` AND p.asesor_id = $3`;
      params.push(req.usuario.id);
    }
    query += ' GROUP BY pr.id, pr.codigo, pr.nombre, pr.categoria ORDER BY total_ventas DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando informe' });
  }
});

// Informe por cliente
router.get('/por-cliente', verificarToken, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let query = `
      SELECT 
        c.nombre as cliente,
        c.ciudad,
        c.telefono,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(p.total), 0) as total_compras,
        COALESCE(SUM(CASE WHEN p.estado = 'Entregado' THEN p.total ELSE 0 END), 0) as compras_entregadas,
        MAX(p.fecha) as ultimo_pedido
      FROM clientes c
      LEFT JOIN pedidos p ON p.cliente_id = c.id AND p.fecha BETWEEN $1 AND $2
    `;
    const params = [desde, hasta];
    if (req.usuario.rol === 'asesor') {
      query += ` AND p.asesor_id = $3`;
      params.push(req.usuario.id);
    }
    query += ' GROUP BY c.id, c.nombre, c.ciudad, c.telefono ORDER BY total_compras DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando informe' });
  }
});

module.exports = router;