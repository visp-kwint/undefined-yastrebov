
class ChunkService {
  /**
   @param {string} text
   @param {number} maxChunkSize
   @returns {Array<string>}
   */
  splitIntoChunks(text, maxChunkSize = 1000) {
    if (!text || text.length === 0) {
      return [];
    }

    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (paragraph.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        let tempChunk = '';
        
        for (const sentence of sentences) {
          if ((tempChunk + sentence).length > maxChunkSize) {
            if (tempChunk) {
              chunks.push(tempChunk.trim());
              tempChunk = sentence;
            } else {
              chunks.push(sentence.substring(0, maxChunkSize));
            }
          } else {
            tempChunk += sentence;
          }
        }
        
        if (tempChunk) {
          chunks.push(tempChunk.trim());
        }
      } else {
        if ((currentChunk + '\n\n' + paragraph).length > maxChunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = paragraph;
        } else {
          if (currentChunk) {
            currentChunk += '\n\n' + paragraph;
          } else {
            currentChunk = paragraph;
          }
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * @param {Array<string>} chunks 
   * @param {Array<number>} indices 
   * @returns {Array<string>} 
   */
  getChunksByIndices(chunks, indices) {
    return indices
      .filter(index => index >= 0 && index < chunks.length)
      .map(index => chunks[index]);
  }
}

module.exports = new ChunkService();