const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // 1. Grab the token from the request header
  const authHeader = req.headers['authorization'];

  // Header should look like: "Bearer eyJhbGci..."
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // 2. Verify the token using your secret key
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // 3. Attach the user info to the request
    req.user = decoded; // { userId, username }
    next(); // move to the actual route
  });
};