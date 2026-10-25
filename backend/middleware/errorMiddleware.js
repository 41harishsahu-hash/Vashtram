// 404 handler for routes that do not exist
const notFound = (req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, _next) => {
  // Preserve explicit status code from Error object (err.statusCode or err.status) or res.statusCode
  let statusCode =
    err.statusCode ||
    err.status ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found with the requested ID';
  }

  // Handle Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}. Please use another value.`;
  }

  // Handle Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired, please login again';
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS policy')) {
    statusCode = 403;
    message = 'Access forbidden: Not allowed by CORS';
  }

  // Handle Multer upload limits
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'Uploaded image file is too large. Maximum size allowed is 5MB.';
  }

  // In production, mask internal 500 errors to avoid leaking paths, stacks, or database internals
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected error occurred. Please try again.';
  } else if (typeof message === 'string') {
    // Strip filesystem paths or connection strings if present
    message = message
      .replace(/[A-Za-z]:\\[^ \t\r\n]+/g, '[path]')
      .replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
