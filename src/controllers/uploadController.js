const streamifier = require('stream');
const { cloudinary } = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function uploadBuffer(buffer, folder) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new AppError('Cloudinary is not configured. Add its credentials to enable image uploads.', 503);
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (error, result) => error ? reject(error) : resolve(result));
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

exports.profileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Choose an image to upload.', 400);
  const result = await uploadBuffer(req.file.buffer, 'teamconnect/profiles');
  req.user.profileImage = result.secure_url;
  await req.user.save();
  res.json({ success: true, imageUrl: result.secure_url, user: req.user });
});

exports.chatImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Choose an image to upload.', 400);
  const result = await uploadBuffer(req.file.buffer, 'teamconnect/chat');
  res.status(201).json({ success: true, imageUrl: result.secure_url });
});
