const router = require('express').Router();
const controller = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.post('/profile-image', upload.single('image'), controller.profileImage);
router.post('/chat-image', upload.single('image'), controller.chatImage);

module.exports = router;
