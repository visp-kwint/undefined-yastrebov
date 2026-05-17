const express = require('express');
const questionAnswerService = require('../services/question-answer.service');

const router = express.Router();

router.get('/:documentId', async (req, res) => {
  try {
    const data = await questionAnswerService.getQuestionsByDocumentId(req.params.documentId);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения истории вопросов'
    });
  }
});

module.exports = router;