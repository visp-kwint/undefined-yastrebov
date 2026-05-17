const generateSummary = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Summary endpoint пока не реализован'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateSummary
};