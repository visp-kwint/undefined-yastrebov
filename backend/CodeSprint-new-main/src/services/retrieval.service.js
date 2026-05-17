const chunkService = require('./chunk.service');

class RetrievalService {
  constructor() {
    this.chunks = [];
  }

  /**
   * @param {string} text
   * @param {string} documentId
   */
  indexDocument(text, documentId) {
    const chunks = chunkService.splitIntoChunks(text);
    this.chunks = chunks.map((chunk, index) => ({
      id: `${documentId}_chunk_${index}`,
      documentId,
      text: chunk,
      index
    }));
    
    return this.chunks;
  }

  /**
   * @param {string} query
   * @param {number} topK
   * @returns {Array}
   */
  retrieveRelevantChunks(query, topK = 3) {
    if (!this.chunks.length) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const keywords = queryLower
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const scoredChunks = this.chunks.map(chunk => {
      const chunkLower = chunk.text.toLowerCase();
      let score = 0;
      
      for (const keyword of keywords) {
        if (chunkLower.includes(keyword)) {
          score += 1;
          if (chunkLower.includes(` ${keyword} `)) {
            score += 1;
          }
        }
      }
      
      return {
        ...chunk,
        score
      };
    });

    return scoredChunks
      .filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  clear() {
    this.chunks = [];
  }
}

module.exports = new RetrievalService();