/**
 * Content Optimizer Service
 * Optimizes tweet content for maximum engagement
 */

export class ContentOptimizer {
  constructor(env) {
    this.env = env;
    this.openaiApiKey = env.OPENAI_API_KEY;
  }

  /**
   * Optimize tweet caption and hashtags
   */
  async optimizeContent(caption, hashtags = []) {
    try {
      const prompt = `
        Optimize this tweet content for maximum viral potential on Japanese Twitter.

        Original Caption: "${caption}"
        Original Hashtags: ${hashtags.join(', ')}

        Instructions:
        1.  Rewrite the caption to be more engaging, emotional, or intriguing.
        2.  Keep the core message, but enhance the wording.
        3.  Suggest 3-4 highly relevant and trending hashtags.
        4.  Ensure the total length is within Twitter's character limit (280 chars).
        5.  Maintain a natural and authentic tone.

        Return the result as a JSON object with this format:
        {
          "optimized_caption": "your-new-caption",
          "optimized_hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
          "explanation": "Briefly explain the changes and why they are better."
        }
      `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const optimizedData = JSON.parse(data.choices[0].message.content);

      return optimizedData;

    } catch (error) {
      console.error('Failed to optimize content:', error);
      return {
        optimized_caption: caption,
        optimized_hashtags: hashtags,
        explanation: 'Content optimization failed. Using original content.'
      };
    }
  }

  /**
   * Generate hashtags based on an image
   * This is a placeholder for potential future multi-modal AI integration
   */
  async generateHashtagsForImage(imageId) {
    // In the future, this could use a vision model to analyze the image
    // and suggest relevant hashtags.
    console.log(`Generating hashtags for image ${imageId}...`);
    
    // For now, return default hashtags
    const defaultHashtags = (this.env.DEFAULT_HASHTAGS || '#AI #AIart').split(',');
    return Promise.resolve(defaultHashtags.map(h => h.trim()));
  }
}