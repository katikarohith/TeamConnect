const router = require('express').Router();
const controller = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/private/:userId', controller.getPrivateMessages);
router.route('/:teamId').get(controller.getTeamMessages).post(controller.createTeamMessage);

module.exports = router;
