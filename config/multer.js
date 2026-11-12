
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Profile image storage folder
const uploadPath = path.join(
  __dirname,
  '../public/uploads/profiles'
);

// Create folder automatically
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      `profile-${req.session.userId}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`;

    cb(null, uniqueName);
  }
});

// Check MIME type
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error('Only JPG, PNG and WEBP images are allowed.')
    );
  }

  cb(null, true);
};

// Multer configuration
const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

// Verify and process uploaded image
const verifyProfileImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  let tempPath;

  try {
    // Verify actual file content
    const { fileTypeFromFile } = await import('file-type');

    const fileType = await fileTypeFromFile(req.file.path);

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!fileType || !allowedTypes.includes(fileType.mime)) {
      fs.unlinkSync(req.file.path);

      return res.redirect(
        `/profile?uploadError=${encodeURIComponent(
          'Invalid image file. Upload a genuine JPG, PNG or WEBP image.'
        )}`
      );
    }

    // Generate optimized WebP filename
    const originalName = path.parse(req.file.filename).name;
    const newFilename = `${originalName}.webp`;

    const newImagePath = path.join(uploadPath, newFilename);

    tempPath = `${newImagePath}.tmp`;

    // Resize and optimize image
    await sharp(req.file.path, {
      failOn: 'error'
    })
      .rotate()
      .resize({
        width: 500,
        height: 500,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({
        quality: 80,
        effort: 4
      })
      .toFile(tempPath);

    // Replace original with optimized image
    fs.renameSync(tempPath, newImagePath);

    // Delete original uploaded file
    fs.unlinkSync(req.file.path);

    // Update file information for controller
    req.file.filename = newFilename;
    req.file.path = newImagePath;
    req.file.destination = uploadPath;
    req.file.mimetype = 'image/webp';

    next();

  } catch (error) {
    console.error('Image processing error:', error);

    // Clean up temporary files
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.redirect(
      `/profile?uploadError=${encodeURIComponent(
        'Unable to process image. Please try another image.'
      )}`
    );
  }
};

module.exports = {
  uploadProfileImage,
  verifyProfileImage
};
