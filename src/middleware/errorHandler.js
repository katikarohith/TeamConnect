function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  let message = error.message || 'Something went wrong.';

  if (error.code === 11000) message = 'That email or invite code is already in use.';
  if (error.name === 'CastError') message = 'The requested resource identifier is invalid.';
  if (error.name === 'MulterError') message = error.code === 'LIMIT_FILE_SIZE' ? 'Image files must be 5 MB or smaller.' : error.message;

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(statusCode).json({ success: false, message, ...(process.env.NODE_ENV === 'development' && statusCode === 500 ? { stack: error.stack } : {}) });
  }
  res.status(statusCode).render('error', { title: 'Something went wrong', statusCode, message });
}

module.exports = { notFound, errorHandler };
