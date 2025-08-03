/**
 * Image Generator Service
 * Handles AI image generation using OpenAI DALL-E 3
 */

export class ImageGenerator {
  constructor(env) {
    this.env = env;
    this.openaiApiKey = env.OPENAI_API_KEY;
    this.imageStorage = new ImageStorage(env);
  }

  /**
   * Generate image using DALL-E 3
   */
  async generateImage(options) {
    const {
      prompt,
      style = 'vivid',
      size = '1024x1024',
      quality = 'standard',
      metadata = {}
    } = options;

    try {
      console.log('Generating image with prompt:', prompt);

      // Call OpenAI DALL-E 3 API
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: size,
          quality: quality,
          style: style,
          response_format: 'url'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;
      const revisedPrompt = data.data[0].revised_prompt;

      // Download and store the image
      const imageData = await this.downloadImage(imageUrl);
      const imageId = this.generateImageId();
      
      // Store image in R2
      await this.imageStorage.storeImage(imageId, imageData, {
        originalPrompt: prompt,
        revisedPrompt: revisedPrompt,
        style: style,
        size: size,
        quality: quality,
        ...metadata
      });

      // Store metadata in database
      await this.storeImageMetadata({
        id: imageId,
        originalPrompt: prompt,
        revisedPrompt: revisedPrompt,
        style: style,
        size: size,
        quality: quality,
        generatedAt: new Date().toISOString(),
        status: 'generated',
        ...metadata
      });

      return {
        id: imageId,
        url: await this.imageStorage.getImageUrl(imageId),
        originalPrompt: prompt,
        revisedPrompt: revisedPrompt,
        metadata: {
          style,
          size,
          quality,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Image generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate multiple images with variations
   */
  async generateImageSet(basePrompt, variations = 3) {
    const prompts = await this.generatePromptVariations(basePrompt, variations);
    
    const generationPromises = prompts.map(async (prompt, index) => {
      try {
        return await this.generateImage({
          prompt,
          metadata: {
            setId: this.generateSetId(),
            variationIndex: index,
            basePrompt: basePrompt
          }
        });
      } catch (error) {
        console.error(`Failed to generate variation ${index}:`, error);
        return null;
      }
    });

    const results = await Promise.all(generationPromises);
    return results.filter(result => result !== null);
  }

  /**
   * Generate prompt variations using GPT-4
   */
  async generatePromptVariations(basePrompt, count = 3) {
    try {
      const prompt = `
        Create ${count} creative variations of this image prompt while maintaining the core concept:
        "${basePrompt}"
        
        Each variation should:
        1. Keep the main subject/theme
        2. Add different artistic styles, angles, or moods
        3. Be optimized for viral social media content
        4. Be suitable for DALL-E 3 generation
        
        Return only the prompts, one per line.
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
          temperature: 0.8,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const variations = content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count);

      return variations.length > 0 ? variations : [basePrompt];

    } catch (error) {
      console.error('Failed to generate prompt variations:', error);
      return [basePrompt];
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    return await response.arrayBuffer();
  }

  /**
   * Store image metadata in D1 database
   */
  async storeImageMetadata(metadata) {
    try {
      const stmt = this.env.DB.prepare(`
        INSERT INTO images (
          id, original_prompt, revised_prompt, style, size, quality,
          generated_at, status, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        metadata.id,
        metadata.originalPrompt,
        metadata.revisedPrompt,
        metadata.style,
        metadata.size,
        metadata.quality,
        metadata.generatedAt,
        metadata.status,
        JSON.stringify(metadata)
      ).run();

    } catch (error) {
      console.error('Failed to store image metadata:', error);
      // Don't throw - image generation succeeded even if metadata storage failed
    }
  }

  /**
   * Get image metadata from database
   */
  async getImageMetadata(imageId) {
    try {
      const stmt = this.env.DB.prepare('SELECT * FROM images WHERE id = ?');
      const result = await stmt.bind(imageId).first();
      
      if (result) {
        return {
          ...result,
          metadata: JSON.parse(result.metadata || '{}')
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get image metadata:', error);
      return null;
    }
  }

  /**
   * List recent images
   */
  async listRecentImages(limit = 20) {
    try {
      const stmt = this.env.DB.prepare(`
        SELECT * FROM images 
        ORDER BY generated_at DESC 
        LIMIT ?
      `);
      
      const results = await stmt.bind(limit).all();
      
      return results.results.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}'),
        url: this.imageStorage.getImageUrl(row.id)
      }));
      
    } catch (error) {
      console.error('Failed to list recent images:', error);
      return [];
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `img_${timestamp}_${random}`;
  }

  /**
   * Generate unique set ID
   */
  generateSetId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `set_${timestamp}_${random}`;
  }

  /**
   * Validate image generation parameters
   */
  validateGenerationParams(options) {
    const { prompt, style, size, quality } = options;

    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt is required');
    }

    if (prompt.length > 4000) {
      throw new Error('Prompt is too long (max 4000 characters)');
    }

    const validStyles = ['vivid', 'natural'];
    if (style && !validStyles.includes(style)) {
      throw new Error(`Invalid style. Must be one of: ${validStyles.join(', ')}`);
    }

    const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
    if (size && !validSizes.includes(size)) {
      throw new Error(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
    }

    const validQualities = ['standard', 'hd'];
    if (quality && !validQualities.includes(quality)) {
      throw new Error(`Invalid quality. Must be one of: ${validQualities.join(', ')}`);
    }

    return true;
  }
}

