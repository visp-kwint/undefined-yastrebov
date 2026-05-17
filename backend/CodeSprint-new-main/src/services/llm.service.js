
class LLMService {
  async generateSummary(text) {
    console.log('🔮 [LLM] Generating summary...');
    

    await new Promise(resolve => setTimeout(resolve, 1500));
    

    const wordCount = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    

    const hasContract = /договор|контракт|contract|agreement/i.test(text);
    const hasDate = text.match(/\d{1,2}\.\d{1,2}\.\d{4}/) || text.match(/\d{4}-\d{2}-\d{2}/);
    const hasAmount = text.match(/\d+[\s]*(?:руб|₽|usd|\$|eur|€)/i);
    const hasParty = /(?:ооо|зао|пао|ип|ooo|llc|inc|co\.|company)/i.test(text);
    
    let summary = '';
    let keyPoints = [];
    
    if (hasContract) {
      summary = '📄 **Договор**\n\n';
      if (hasParty) summary += 'Стороны: юридические лица\n';
      if (hasDate) summary += `Дата: ${hasDate[0]}\n`;
      if (hasAmount) summary += `Сумма: ${hasAmount[0]}\n`;
      
      keyPoints = [
        'Документ является договором',
        hasDate ? `Указана дата: ${hasDate[0]}` : 'Дата не указана явно',
        hasAmount ? `Фигурирует сумма: ${hasAmount[0]}` : 'Сумма не указана',
        `Объем текста: ${wordCount} слов`
      ];
    } else {

      const firstSentences = sentences.slice(0, 3).join('. ') + '.';
      summary = firstSentences;
      
      keyPoints = [
        `Документ содержит ${wordCount} слов`,
        hasDate ? `Упоминается дата: ${hasDate[0]}` : 'Датировка не обнаружена',
        hasAmount ? `Сумма: ${hasAmount[0]}` : 'Финансовые показатели не указаны',
        `Количество предложений: ${sentences.length}`
      ];
    }
    
    return {
      summary,
      keyPoints,
      metadata: {
        wordCount,
        sentenceCount: sentences.length,
        hasContract,
        hasDate: !!hasDate,
        hasAmount: !!hasAmount
      }
    };
  }

  async answerQuestion(question, context) {
    console.log('[LLM] Answering question:', question);
    

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const questionLower = question.toLowerCase();
    const contextLower = context.toLowerCase();
    

    const keywords = questionLower
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    

    const sentences = context.split(/[.!?]+/).map(s => s.trim());
    const relevantSentences = [];
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      let matchCount = 0;
      
      for (const keyword of keywords) {
        if (sentenceLower.includes(keyword)) {
          matchCount++;
        }
      }
      
      if (matchCount >= Math.min(2, keywords.length)) {
        relevantSentences.push(sentence);
      }
    }
    
    if (relevantSentences.length > 0) {
      return {
        answer: relevantSentences[0],
        confidence: 0.8,
        source: 'Найдено в документе'
      };
    }
    

    return {
      answer: 'Информация отсутствует в загруженном файле',
      confidence: 0,
      source: null
    };
  }
}

module.exports = new LLMService();