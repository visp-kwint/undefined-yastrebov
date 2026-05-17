const prisma = require('./prisma.service');

async function createQuestionAnswer(data) {
  return prisma.questionAnswer.create({
    data: {
      documentId: data.documentId,
      question: data.question,
      answer: data.answer,
      sourceChunk: data.sourceChunk || null
    }
  });
}

async function getQuestionsByDocumentId(documentId) {
  return prisma.questionAnswer.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = {
  createQuestionAnswer,
  getQuestionsByDocumentId
};