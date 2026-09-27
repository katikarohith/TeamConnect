const router = require('express').Router();
const controller = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(controller.listTasks).post(controller.createTask);
router.route('/:id').get(controller.getTask).put(controller.updateTask).delete(controller.deleteTask);

module.exports = router;
