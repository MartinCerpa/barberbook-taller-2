const COOKIE_NAME = 'barberbook_t3_session';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', path: '/api',
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true' });
const readToken = (req) => req.headers.cookie?.split(';').map((item) => item.trim())
  .find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);

export async function requireSession(req, res, next) {
  const professional = await req.app.locals.auth.session(readToken(req));
  if (!professional) return res.status(401).json({ error: 'Inicia sesión para acceder al panel profesional.' });
  req.professional = professional;
  next();
}

export function requireCsrf(req, res, next) {
  if (req.get('X-CSRF-Token') !== req.professional.csrfToken) {
    return res.status(403).json({ error: 'Token CSRF inválido.' });
  }
  next();
}

export async function login(req, res) {
  // También protege el propio login frente a formularios enviados desde otro sitio.
  const allowed = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_ORIGIN,
    `${req.protocol}://${req.get('host')}`]);
  if (req.get('Origin') && !allowed.has(req.get('Origin'))) return res.status(403).json({ error: 'Origen de acceso no permitido.' });
  const body = req.body;
  if (!body || Array.isArray(body) || Object.keys(body).some((key) => !['email', 'password'].includes(key)) ||
      typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      typeof body.password !== 'string' || !body.password.length || body.password.length > 128) {
    return res.status(400).json({ error: 'Revisa el correo y la contraseña.' });
  }
  const result = await req.app.locals.auth.login(body.email.trim(), body.password, req.ip, readToken(req));
  res.cookie(COOKIE_NAME, result.token, { ...cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
  res.set('Cache-Control', 'no-store').json({ data: result.user });
}

export function session(req, res) {
  res.set('Cache-Control', 'no-store').json({ data: req.professional });
}

export async function logout(req, res) {
  await req.app.locals.auth.logout(readToken(req));
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ data: { loggedOut: true } });
}
