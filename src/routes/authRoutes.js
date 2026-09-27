const router = require('express').Router();
const auth = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

router.post('/register', rateLimit({ prefix: 'teamconnect:register', windowSeconds: 3600, max: 10 }), auth.register);
router.post('/login', rateLimit({ prefix: 'teamconnect:login', windowSeconds: 900, max: 10 }), auth.login);
router.post('/logout', protect, auth.logout);
router.get('/me', protect, auth.me);
router.patch('/profile', protect, auth.updateProfile);

module.exports = router;
