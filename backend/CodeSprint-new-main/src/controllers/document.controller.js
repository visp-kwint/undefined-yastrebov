const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllDocuments = async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Ошибка получения документов:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении документов' });
  }
};

const getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id }
    });
    if (!document) {
      return res.status(404).json({ success: false, message: 'Документ не найден' });
    }
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Ошибка получения документа:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении документа' });
  }
};

module.exports = { getAllDocuments, getDocument };