const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'sushi-secret-key-change-in-prod';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { requireAuth, SECRET };
