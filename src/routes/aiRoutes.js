const router = require('express').Router();
const controller = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

router.use(protect, rateLimit({ prefix: 'teamconnect:ai', windowSeconds: 300, max: 12 }));
router.post('/task-breakdown', controller.taskBreakdown);
router.post('/chat-summary', controller.chatSummary);

module.exports = router;
