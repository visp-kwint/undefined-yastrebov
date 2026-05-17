const express = require('express');
const {
  getDocument,
  getAllDocuments
} = require('../controllers/document.controller');

const router = express.Router();

router.get('/', getAllDocuments);
router.get('/:id', getDocument);

module.exports = router;