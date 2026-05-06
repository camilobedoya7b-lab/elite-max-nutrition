const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin')
    return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

const soloLogistica = (req, res, next) => {
  if (!['admin', 'logistica'].includes(req.usuario.rol))
    return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

module.exports = { verificarToken, soloAdmin, soloLogistica };