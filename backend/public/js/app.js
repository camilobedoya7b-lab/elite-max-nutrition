const API = 'https://elite-max-nutrition-production.up.railway.app/api';
let token = localStorage.getItem('token');
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
let productos = [];
let clientes = [];

// ===== UTILIDADES =====
const fmt = n => '$' + Number(n).toLocaleString('es-CO');
const badgeEstado = e => {
  const map = {
    'Recibido': 'badge-recibido', 'En preparacion': 'badge-preparacion',
    'Despachado': 'badge-despachado', 'Entregado': 'badge-entregado'
  };
  return `<span class="badge ${map[e] || ''}">${e}</span>`;
};

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ===== LOGIN =====
async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('hidden');
  try {
    const data = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);
    token = data.token;
    usuario = data.usuario;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    iniciarApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

function logout() {
  localStorage.clear();
  token = null; usuario = null;
  document.getElementById('appPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
}

// ===== INICIAR APP =====
async function iniciarApp() {
  if (!token || !usuario) return;
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appPage').classList.remove('hidden');
  document.getElementById('navNombre').textContent = `Hola, ${usuario.nombre} 👋`;
  const rolLabels = { asesor: 'Asesor', logistica: 'Logística', admin: 'Admin' };
  const rolColors = { asesor: 'badge-asesor', logistica: 'badge-logistica', admin: 'badge-admin' };
  const badge = document.getElementById('navRolBadge');
  badge.textContent = rolLabels[usuario.rol];
  badge.className = `badge ${rolColors[usuario.rol]}`;

  // Ocultar todas las vistas primero
  document.getElementById('vistaAsesor').classList.add('hidden');
  document.getElementById('vistaLogistica').classList.add('hidden');
  document.getElementById('vistaAdmin').classList.add('hidden');

  // Mostrar solo la vista correcta
  if (usuario.rol === 'asesor') {
    document.getElementById('vistaAsesor').classList.remove('hidden');
    await cargarDatosAsesor();
  } else if (usuario.rol === 'logistica') {
    document.getElementById('vistaLogistica').classList.remove('hidden');
    await cargarPedidosLogistica();
  } else if (usuario.rol === 'admin') {
    document.getElementById('vistaAdmin').classList.remove('hidden');
    await cargarDatosAdmin();
  }
}

// ===== VISTA ASESOR =====
async function cargarDatosAsesor() {
  await Promise.all([cargarMetaAsesor(), cargarPedidosAsesor(), cargarProductos(), cargarClientes()]);
}

async function cargarMetaAsesor() {
  try {
    const metas = await api('/metas');
    const meta = metas[0];
    const el = document.getElementById('metaContainer');
    if (!meta) { el.innerHTML = '<p style="color:#888;font-size:14px">Sin meta asignada este mes.</p>'; return; }
    const pct = Math.min((meta.vendido / meta.meta) * 100, 100).toFixed(1);
    const faltan = Math.max(meta.meta - meta.vendido, 0);
    const hoy = new Date();
    const diasRestantes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate() - hoy.getDate();
    el.innerHTML = `
      <div style="margin-bottom:8px;font-weight:700;color:var(--azul);font-size:15px">🎯 Tu Meta de ${new Date().toLocaleString('es-CO',{month:'long'})} ${hoy.getFullYear()}</div>
      <div class="meta-header"><span class="meta-label">${fmt(meta.vendido)} vendido</span><span class="meta-porcentaje">${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="meta-detalle"><span>Meta: ${fmt(meta.meta)}</span><span>💰 Faltan ${fmt(faltan)}</span><span>📅 ${diasRestantes} días restantes</span></div>`;
  } catch { }
}

async function cargarPedidosAsesor() {
  try {
    const pedidos = await api('/pedidos');
    const el = document.getElementById('listaPedidosAsesor');
    if (!pedidos.length) { el.innerHTML = '<p style="color:#888;text-align:center;padding:24px">No tienes pedidos aún. ¡Crea tu primer pedido!</p>'; return; }
    el.innerHTML = pedidos.map(p => `
      <div class="pedido-card">
        <div class="pedido-header">
          <div>
            <div class="pedido-codigo">${p.codigo} • ${new Date(p.fecha).toLocaleDateString('es-CO')}</div>
            <div class="pedido-cliente">${p.cliente_nombre}</div>
          </div>
          ${badgeEstado(p.estado)}
        </div>
        <div class="pedido-productos">${(p.productos||[]).filter(x=>x.producto_id).map(x=>`${x.producto_nombre} x${x.cantidad}`).join(' • ')}</div>
        <div class="pedido-footer">
          <span class="pedido-total">${fmt(p.total)}</span>
          <span style="font-size:12px;color:#888">${p.observaciones || ''}</span>
        </div>
      </div>`).join('');
  } catch(err) { console.error(err); }
}

// ===== VISTA LOGISTICA =====
async function cargarPedidosLogistica() {
  try {
    const filtro = document.getElementById('filtroEstado')?.value || '';
    let pedidos = await api('/pedidos');
    if (filtro) pedidos = pedidos.filter(p => p.estado === filtro);
    const el = document.getElementById('listaPedidosLogistica');
    if (!pedidos.length) { el.innerHTML = '<p style="color:#888;text-align:center;padding:24px">No hay pedidos.</p>'; return; }
    el.innerHTML = pedidos.map(p => `
      <div class="pedido-card">
        <div class="pedido-header">
          <div>
            <div class="pedido-codigo">${p.codigo} • ${new Date(p.fecha).toLocaleDateString('es-CO')} • Asesor: ${p.asesor_nombre}</div>
            <div class="pedido-cliente">${p.cliente_nombre} — ${p.cliente_ciudad || ''}</div>
          </div>
          ${badgeEstado(p.estado)}
        </div>
        <div class="pedido-productos">${(p.productos||[]).filter(x=>x.producto_id).map(x=>`${x.producto_nombre} x${x.cantidad}`).join(' • ')}</div>
        <div class="pedido-footer">
          <span class="pedido-total">${fmt(p.total)}</span>
          <button class="btn btn-dorado btn-sm" onclick="abrirModalEstado(${p.id}, '${p.estado}', \`${p.observaciones||''}\`)">Actualizar estado</button>
        </div>
      </div>`).join('');
  } catch(err) { console.error(err); }
}

// ===== MODAL ESTADO =====
function abrirModalEstado(id, estado, obs) {
  document.getElementById('estadoPedidoId').value = id;
  document.getElementById('nuevoEstado').value = estado;
  document.getElementById('estadoObservaciones').value = obs;
  document.getElementById('modalEstado').classList.remove('hidden');
}
function cerrarModalEstado() { document.getElementById('modalEstado').classList.add('hidden'); }

async function actualizarEstado() {
  const id = document.getElementById('estadoPedidoId').value;
  const estado = document.getElementById('nuevoEstado').value;
  const observaciones = document.getElementById('estadoObservaciones').value;
  try {
    await api(`/pedidos/${id}/estado`, 'PUT', { estado, observaciones });
    cerrarModalEstado();
    cargarPedidosLogistica();
  } catch(err) { alert(err.message); }
}

// ===== PRODUCTOS Y CLIENTES =====
async function cargarProductos() {
  productos = await api('/productos');
}
async function cargarClientes() {
  clientes = await api('/clientes');
  const sel = document.getElementById('pedidoCliente');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar cliente...</option>' +
      clientes.map(c => `<option value="${c.id}" data-descuento="${c.descuento}">${c.nombre} — ${c.ciudad}</option>`).join('');
  }
}

function cargarDescuentoCliente() {
  const sel = document.getElementById('pedidoCliente');
  const opt = sel.options[sel.selectedIndex];
  const desc = opt?.dataset?.descuento || 0;
  document.getElementById('pedidoDescuento').value = desc;
  calcularTotal();
}

// ===== MODAL PEDIDO =====
async function abrirModalPedido() {
  await Promise.all([cargarProductos(), cargarClientes()]);
  document.getElementById('productosRows').innerHTML = '';
  document.getElementById('pedidoDescuento').value = 0;
  document.getElementById('pedidoObservaciones').value = '';
  document.getElementById('modalError').classList.add('hidden');
  agregarProductoRow();
  calcularTotal();
  document.getElementById('modalPedido').classList.remove('hidden');
}
function cerrarModalPedido() { document.getElementById('modalPedido').classList.add('hidden'); }

function agregarProductoRow() {
  const div = document.createElement('div');
  div.className = 'producto-row';
  div.innerHTML = `
    <select class="prod-select" onchange="actualizarPrecio(this)">
      <option value="">Seleccionar producto...</option>
      ${productos.map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre}</option>`).join('')}
    </select>
    <input type="number" class="prod-cantidad" placeholder="Cant." min="1" value="1" oninput="calcularTotal()">
    <input type="number" class="prod-precio" placeholder="Precio" readonly>
    <button onclick="this.parentElement.remove();calcularTotal()" style="background:#fdecea;border:none;border-radius:6px;cursor:pointer;color:#e74c3c;font-size:18px">×</button>`;
  document.getElementById('productosRows').appendChild(div);
}

function actualizarPrecio(sel) {
  const opt = sel.options[sel.selectedIndex];
  const precio = opt?.dataset?.precio || 0;
  sel.parentElement.querySelector('.prod-precio').value = precio;
  calcularTotal();
}

function calcularTotal() {
  const rows = document.querySelectorAll('.producto-row');
  let subtotal = 0;
  rows.forEach(row => {
    const cantidad = parseFloat(row.querySelector('.prod-cantidad')?.value || 0);
    const precio = parseFloat(row.querySelector('.prod-precio')?.value || 0);
    subtotal += cantidad * precio;
  });
  const descuento = parseFloat(document.getElementById('pedidoDescuento')?.value || 0);
  const descuentoVal = subtotal * descuento / 100;
  const total = subtotal - descuentoVal;
  document.getElementById('totalSubtotal').textContent = fmt(subtotal);
  document.getElementById('totalDescuento').textContent = `-${fmt(descuentoVal)}`;
  document.getElementById('totalFinal').textContent = fmt(total);
}

async function crearPedido() {
  const cliente_id = document.getElementById('pedidoCliente').value;
  const descuento = parseFloat(document.getElementById('pedidoDescuento').value || 0);
  const observaciones = document.getElementById('pedidoObservaciones').value;
  const errorEl = document.getElementById('modalError');
  errorEl.classList.add('hidden');
  if (!cliente_id) { errorEl.textContent = 'Selecciona un cliente'; errorEl.classList.remove('hidden'); return; }
  const rows = document.querySelectorAll('.producto-row');
  const productosSeleccionados = [];
  for (const row of rows) {
    const producto_id = row.querySelector('.prod-select').value;
    const cantidad = parseInt(row.querySelector('.prod-cantidad').value);
    const precio_unitario = parseFloat(row.querySelector('.prod-precio').value);
    if (producto_id && cantidad > 0 && precio_unitario > 0) {
      productosSeleccionados.push({ producto_id: parseInt(producto_id), cantidad, precio_unitario });
    }
  }
  if (!productosSeleccionados.length) { errorEl.textContent = 'Agrega al menos un producto'; errorEl.classList.remove('hidden'); return; }
  try {
    await api('/pedidos', 'POST', { cliente_id: parseInt(cliente_id), productos: productosSeleccionados, descuento, observaciones });
    cerrarModalPedido();
    cargarPedidosAsesor();
    cargarMetaAsesor();
  } catch(err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

// ===== VISTA ADMIN =====
async function cargarDatosAdmin() {
  try {
    const pedidos = await api('/pedidos');
    const stats = {
      total: pedidos.length,
      recibido: pedidos.filter(p => p.estado === 'Recibido').length,
      preparacion: pedidos.filter(p => p.estado === 'En preparacion').length,
      despachado: pedidos.filter(p => p.estado === 'Despachado').length,
      entregado: pedidos.filter(p => p.estado === 'Entregado').length,
    };
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="number">${stats.total}</div><div class="label">Total Pedidos</div></div>
      <div class="stat-card" style="border-top-color:#e74c3c"><div class="number" style="color:#e74c3c">${stats.recibido}</div><div class="label">Recibidos</div></div>
      <div class="stat-card" style="border-top-color:#f39c12"><div class="number" style="color:#f39c12">${stats.preparacion}</div><div class="label">En Preparación</div></div>
      <div class="stat-card" style="border-top-color:#2980b9"><div class="number" style="color:#2980b9">${stats.despachado}</div><div class="label">Despachados</div></div>
      <div class="stat-card" style="border-top-color:#27ae60"><div class="number" style="color:#27ae60D">${stats.entregado}</div><div class="label">Entregados</div></div>`;
    tabAdmin('pedidos', document.querySelector('.tab.active'));
  } catch(err) { console.error(err); }
}

async function tabAdmin(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const contenido = document.getElementById('adminContenido');

  if (tab === 'pedidos') {
    const pedidos = await api('/pedidos');
    contenido.innerHTML = `<div class="card"><table class="tabla">
      <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Total</th><th>Estado</th><th></th></tr></thead>
      <tbody>${pedidos.map(p => `<tr>
        <td>${p.codigo}</td>
        <td>${new Date(p.fecha).toLocaleDateString('es-CO')}</td>
        <td>${p.cliente_nombre}</td>
        <td>${p.asesor_nombre}</td>
        <td>${fmt(p.total)}</td>
        <td>${badgeEstado(p.estado)}</td>
        <td><button class="btn btn-dorado btn-sm" onclick="abrirModalEstado(${p.id},'${p.estado}','${p.observaciones||''}')">Actualizar</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;

  } else if (tab === 'productos') {
    const prods = await api('/productos');
    contenido.innerHTML = `<div class="card">
      <div class="card-header"><span class="card-title">🥤 Productos</span>
      <button class="btn btn-dorado btn-sm" onclick="formProducto()">+ Nuevo</button></div>
      <table class="tabla"><thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Unidad</th></tr></thead>
      <tbody>${prods.map(p=>`<tr><td>${p.nombre}</td><td>${p.categoria||'-'}</td><td>${fmt(p.precio)}</td><td>${p.unidad||'-'}</td></tr>`).join('')}</tbody>
      </table></div>`;

  } else if (tab === 'clientes') {
    const cls = await api('/clientes');
    contenido.innerHTML = `<div class="card">
      <div class="card-header"><span class="card-title">👥 Clientes</span>
      <button class="btn btn-dorado btn-sm" onclick="formCliente()">+ Nuevo</button></div>
      <table class="tabla"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Ciudad</th><th>Descuento</th></tr></thead>
      <tbody>${cls.map(c=>`<tr><td>${c.nombre}</td><td>${c.telefono||'-'}</td><td>${c.ciudad||'-'}</td><td>${c.descuento||0}%</td></tr>`).join('')}</tbody>
      </table></div>`;

  } else if (tab === 'usuarios') {
    const users = await api('/usuarios');
    contenido.innerHTML = `<div class="card">
      <div class="card-header">
        <span class="card-title">👤 Usuarios del Sistema</span>
        <button class="btn btn-dorado btn-sm" onclick="formUsuario()">+ Nuevo Usuario</button>
      </div>
      <table class="tabla">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>${users.map(u => `<tr>
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td><span class="badge badge-${u.rol}">${u.rol}</span></td>
        <td><span class="badge ${u.activo ? 'badge-entregado' : 'badge-recibido'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td><button class="btn btn-dorado btn-sm" onclick="editarUsuario(${u.id},'${u.nombre}','${u.email}','${u.rol}',${u.activo})">Editar</button></td>
      </tr>`).join('')}</tbody>
      </table>
    </div>`;

  } else if (tab === 'metas') {
    const metas = await api('/metas');
    const asesores = await api('/usuarios').catch(() => []);
    contenido.innerHTML = `<div class="card">
      <div class="card-header"><span class="card-title">🎯 Metas del Mes</span></div>
      ${metas.length ? metas.map(m => {
        const pct = Math.min((m.vendido/m.meta)*100,100).toFixed(1);
        return `<div style="margin-bottom:20px">
          <div class="meta-header"><span class="meta-label">${m.asesor_nombre}</span><span class="meta-porcentaje">${pct}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="meta-detalle"><span>Vendido: ${fmt(m.vendido)}</span><span>Meta: ${fmt(m.meta)}</span></div>
        </div>`;
      }).join('') : '<p style="color:#888">No hay metas asignadas este mes.</p>'}
      <hr style="margin:20px 0">
      <div class="card-title" style="margin-bottom:16px">Asignar Meta</div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end">
        <div class="form-group" style="margin:0"><label>Asesor</label>
          <select id="metaAsesorId">${asesores.filter(u=>u.rol==='asesor').map(u=>`<option value="${u.id}">${u.nombre}</option>`).join('')}</select>
        </div>
        <div class="form-group" style="margin:0"><label>Meta ($)</label>
          <input type="number" id="metaValor" placeholder="30000000">
        </div>
        <button class="btn btn-dorado" onclick="guardarMeta()">Guardar</button>
      </div>
    </div>`;
  }
}

async function guardarMeta() {
  const asesor_id = document.getElementById('metaAsesorId').value;
  const meta = document.getElementById('metaValor').value;
  const hoy = new Date();
  try {
    await api('/metas', 'POST', { asesor_id: parseInt(asesor_id), meta: parseFloat(meta), mes: hoy.getMonth()+1, año: hoy.getFullYear() });
    tabAdmin('metas', document.querySelector('.tab.active'));
  } catch(err) { alert(err.message); }
}

function formProducto() {
  const nombre = prompt('Nombre del producto:');
  if (!nombre) return;
  const precio = prompt('Precio:');
  const categoria = prompt('Categoría:');
  const unidad = prompt('Unidad (ej: Unidad, Kg):');
  api('/productos', 'POST', { nombre, precio: parseFloat(precio), categoria, unidad })
    .then(() => tabAdmin('productos', document.querySelector('.tab.active')))
    .catch(err => alert(err.message));
}

function formCliente() {
  const nombre = prompt('Nombre del cliente:');
  if (!nombre) return;
  const telefono = prompt('Teléfono:');
  const ciudad = prompt('Ciudad:');
  const direccion = prompt('Dirección:');
  const descuento = prompt('Descuento % (0 si no tiene):') || 0;
  api('/clientes', 'POST', { nombre, telefono, ciudad, direccion, descuento: parseFloat(descuento) })
    .then(() => tabAdmin('clientes', document.querySelector('.tab.active')))
    .catch(err => alert(err.message));
}

function formUsuario() {
  const nombre = prompt('Nombre completo:');
  if (!nombre) return;
  const email = prompt('Email:');
  const password = prompt('Contraseña temporal:');
  const rol = prompt('Rol (asesor / logistica / admin):');
  if (!['asesor', 'logistica', 'admin'].includes(rol)) {
    alert('Rol inválido. Debe ser: asesor, logistica o admin');
    return;
  }
  api('/usuarios', 'POST', { nombre, email, password, rol })
    .then(() => tabAdmin('usuarios', document.querySelector('.tab.active')))
    .catch(err => alert(err.message));
}
function editarUsuario(id, nombre, email, rol, activo) {
  const nuevoNombre = prompt('Nombre:', nombre);
  if (!nuevoNombre) return;
  const nuevoEmail = prompt('Email:', email);
  const nuevoRol = prompt('Rol (asesor / logistica / admin):', rol);
  const nuevaPassword = prompt('Nueva contraseña (dejar vacío para no cambiar):');
  const nuevoActivo = confirm('¿Usuario activo?');

  if (!['asesor', 'logistica', 'admin'].includes(nuevoRol)) {
    alert('Rol inválido');
    return;
  }

  const body = { nombre: nuevoNombre, email: nuevoEmail, rol: nuevoRol, activo: nuevoActivo };
  if (nuevaPassword) body.password = nuevaPassword;

  api(`/usuarios/${id}`, 'PUT', body)
    .then(() => tabAdmin('usuarios', document.querySelector('.tab.active')))
    .catch(err => alert(err.message));
}

// ===== INICIO =====
if (token && usuario) iniciarApp();