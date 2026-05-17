const express = require('express');
const upload = require('../middlewares/upload.middleware');
const { uploadDocument } = require('../controllers/upload.controller');

const router = express.Router();

router.post('/', upload.single('file'), uploadDocument);

module.exports = router;