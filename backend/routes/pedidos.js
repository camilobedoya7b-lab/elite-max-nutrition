const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, soloLogistica } = require('../middleware/auth');

// Función para calcular destino automáticamente
function calcularDestino(total, metodo_pago) {
  if (metodo_pago === 'Credito') return 'Facturacion';
  if (total >= 1500000) return 'Facturacion';
  return 'Logistica';
}

// Obtener pedidos filtrados por rol
router.get('/', verificarToken, async (req, res) => {
  try {
    let query = `
      SELECT p.*,
        u.nombre as asesor_nombre,
        u.id as asesor_codigo,
        c.nombre as cliente_nombre,
        c.ciudad as cliente_ciudad,
        c.telefono as cliente_telefono,
        c.direccion as cliente_direccion,
        json_agg(json_build_object(
          'id', dp.id,
          'producto_id', dp.producto_id,
          'producto_nombre', pr.nombre,
          'producto_codigo', pr.codigo,
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
    } else if (req.usuario.rol === 'logistica') {
      query += " WHERE p.destino = 'Logistica' AND p.estado != 'Entregado'";
    } else if (req.usuario.rol === 'facturacion') {
      query += " WHERE p.destino = 'Facturacion'";
    }

    query += ' GROUP BY p.id, u.nombre, u.id, c.nombre, c.ciudad, c.telefono, c.direccion ORDER BY p.fecha DESC, p.id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

// Crear pedido
router.post('/', verificarToken, async (req, res) => {
  const { cliente_id, productos, descuento, observaciones, metodo_pago } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    for (const item of productos) subtotal += item.cantidad * item.precio_unitario;
    const total = subtotal - (subtotal * (descuento || 0) / 100);
    const destino = calcularDestino(total, metodo_pago || 'Efectivo');

    const count = await client.query('SELECT COUNT(*) FROM pedidos');
    const codigo = `PED${String(parseInt(count.rows[0].count) + 1).padStart(4, '0')}`;

    const pedidoResult = await client.query(
      `INSERT INTO pedidos (codigo, asesor_id, cliente_id, descuento, subtotal, total, observaciones, metodo_pago, destino)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [codigo, req.usuario.id, cliente_id, descuento || 0, subtotal, total, observaciones, metodo_pago || 'Efectivo', destino]
    );

    const pedido = pedidoResult.rows[0];

    for (const item of productos) {
      await client.query(
        `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [pedido.id, item.producto_id, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario]
      );
    }

    await client.query('COMMIT');
    res.json({ ...pedido, destino });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error creando pedido' });
  } finally {
    client.release();
  }
});

// Actualizar estado
router.put('/:id/estado', verificarToken, async (req, res) => {
  const { estado, observaciones } = req.body;
  if (!['admin', 'logistica', 'facturacion'].includes(req.usuario.rol))
    return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const result = await pool.query(
      `UPDATE pedidos SET estado=$1, observaciones=$2, fecha_actualizacion=NOW() WHERE id=$3 RETURNING *`,
      [estado, observaciones, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando estado' });
  }
});

// Editar pedido completo
router.put('/:id', verificarToken, async (req, res) => {
  const { cliente_id, productos, descuento, observaciones, metodo_pago } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pedidoActual = await client.query('SELECT * FROM pedidos WHERE id=$1', [req.params.id]);
    if (!pedidoActual.rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });

    const pedido = pedidoActual.rows[0];

    // Restricción de edición por estado para asesores
    if (req.usuario.rol === 'asesor') {
      if (pedido.asesor_id !== req.usuario.id)
        return res.status(403).json({ error: 'No puedes editar pedidos de otros asesores' });
      if (pedido.estado !== 'Recibido')
        return res.status(403).json({ error: 'Solo puedes editar pedidos en estado Recibido' });
    }

    let subtotal = 0;
    for (const item of productos) subtotal += item.cantidad * item.precio_unitario;
    const total = subtotal - (subtotal * (descuento || 0) / 100);
    const destino = calcularDestino(total, metodo_pago || pedido.metodo_pago);

    await client.query(
      `UPDATE pedidos SET cliente_id=$1, descuento=$2, subtotal=$3, total=$4, observaciones=$5, metodo_pago=$6, destino=$7, fecha_actualizacion=NOW() WHERE id=$8`,
      [cliente_id, descuento || 0, subtotal, total, observaciones, metodo_pago || pedido.metodo_pago, destino, req.params.id]
    );

    await client.query('DELETE FROM detalle_pedidos WHERE pedido_id=$1', [req.params.id]);
    for (const item of productos) {
      await client.query(
        `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, item.producto_id, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Pedido actualizado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error actualizando pedido' });
  } finally {
    client.release();
  }
});

// Eliminar pedido
router.delete('/:id', verificarToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pedidoActual = await client.query('SELECT * FROM pedidos WHERE id=$1', [req.params.id]);
    if (!pedidoActual.rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (req.usuario.rol === 'asesor' && pedidoActual.rows[0].asesor_id !== req.usuario.id)
      return res.status(403).json({ error: 'No puedes eliminar pedidos de otros asesores' });
    await client.query('DELETE FROM detalle_pedidos WHERE pedido_id=$1', [req.params.id]);
    await client.query('DELETE FROM pedidos WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Pedido eliminado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error eliminando pedido' });
  } finally {
    client.release();
  }
});

module.exports = router;