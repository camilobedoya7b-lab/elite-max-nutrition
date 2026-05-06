const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, soloLogistica } = require('../middleware/auth');

// Obtener pedidos (asesor ve los suyos, logistica/admin ve todos)
router.get('/', verificarToken, async (req, res) => {
  try {
    let query = `
      SELECT p.*, 
        u.nombre as asesor_nombre,
        c.nombre as cliente_nombre,
        c.ciudad as cliente_ciudad,
        json_agg(json_build_object(
          'id', dp.id,
          'producto_id', dp.producto_id,
          'producto_nombre', pr.nombre,
          'cantidad', dp.cantidad,
          'precio_unitario', dp.precio_unitario,
          'subtotal', dp.subtotal
        )) as productos
      FROM pedidos p
      LEFT JOIN usuarios u ON p.asesor_id = u.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN detalle_pedidos dp ON dp.pedido_id = p.id
      LEFT JOIN productos pr ON dp.producto_id = pr.id
    `;

    const params = [];
    if (req.usuario.rol === 'asesor') {
      query += ' WHERE p.asesor_id = $1';
      params.push(req.usuario.id);
    }

    query += ' GROUP BY p.id, u.nombre, c.nombre, c.ciudad ORDER BY p.fecha DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

// Crear pedido (solo asesores)
router.post('/', verificarToken, async (req, res) => {
  const { cliente_id, productos, descuento, observaciones } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Calcular subtotal
    let subtotal = 0;
    for (const item of productos) {
      subtotal += item.cantidad * item.precio_unitario;
    }
    const total = subtotal - (subtotal * (descuento || 0) / 100);

    // Generar código único
    const count = await client.query('SELECT COUNT(*) FROM pedidos');
    const codigo = `PED${String(parseInt(count.rows[0].count) + 1).padStart(4, '0')}`;

    // Insertar pedido
    const pedidoResult = await client.query(
      `INSERT INTO pedidos (codigo, asesor_id, cliente_id, descuento, subtotal, total, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [codigo, req.usuario.id, cliente_id, descuento || 0, subtotal, total, observaciones]
    );

    const pedido = pedidoResult.rows[0];

    // Insertar detalle de productos
    for (const item of productos) {
      await client.query(
        `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedido.id, item.producto_id, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario]
      );
    }

    await client.query('COMMIT');
    res.json(pedido);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error creando pedido' });
  } finally {
    client.release();
  }
});

// Actualizar estado (logistica y admin)
router.put('/:id/estado', verificarToken, soloLogistica, async (req, res) => {
  const { estado, observaciones } = req.body;
  try {
    const result = await pool.query(
      `UPDATE pedidos SET estado=$1, observaciones=$2, fecha_actualizacion=NOW()
       WHERE id=$3 RETURNING *`,
      [estado, observaciones, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando estado' });
  }
});

module.exports = router;