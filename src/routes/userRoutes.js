const router = require('express').Router();
const { presence } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/:id/presence', protect, presence);
module.exports = router;
