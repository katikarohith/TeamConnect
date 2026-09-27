const multer = require('multer');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();
const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (allowed.includes(file.mimetype)) callback(null, true);
    else callback(new AppError('Please upload a JPG, PNG, WEBP, or GIF image.', 400));
  }
});

module.exports = upload;
