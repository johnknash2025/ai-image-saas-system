/**
 * Prompt Optimizer Service
 * Optimizes prompts for viral content generation
 */

export class PromptOptimizer {
  constructor(env) {
    this.env = env;
    this.openaiApiKey = env.OPENAI_API_KEY;
  }

  /**
   * Generate viral prompts based on trending topics
   */
  async generateViralPrompts(trends, count = 10) {
    try {
      const topTrends = trends.slice(0, 8);
      
      const prompt = `
        Create ${count} viral-worthy image prompts based on these trending topics:
        ${topTrends.map(t => `- ${t.keyword} (${t.category}, volume: ${t.volume})`).join('\n')}
        
        Requirements:
        1. Each prompt should incorporate 1-2 trending keywords naturally
        2. Optimize for social media virality (cute, funny, relatable, or visually striking)
        3. Consider Japanese culture and preferences
        4. Make them suitable for DALL-E 3 generation
        5. Include specific visual details and artistic style
        6. Keep prompts under 300 characters
        
        Format each prompt as:
        {
          "prompt": "detailed image prompt",
          "keywords": ["keyword1", "keyword2"],
          "style": "artistic style",
          "viral_elements": ["element1", "element2"],
          "target_audience": "audience description",
          "estimated_engagement": 1-10
        }
        
        Return as JSON array.
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
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const prompts = JSON.parse(jsonMatch[0]);
        
        // Add metadata and score
        return prompts.map((p, index) => ({
          ...p,
          id: this.generatePromptId(),
          created_at: new Date().toISOString(),
          trends_used: topTrends.filter(t => 
            p.keywords.some(k => k.toLowerCase().includes(t.keyword.toLowerCase()))
          ),
          score: this.calculateViralScore(p, topTrends)
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to generate viral prompts:', error);
      return this.getFallbackPrompts(trends);
    }
  }

  /**
   * Optimize existing prompt for better viral potential
   */
  async optimizePrompt(originalPrompt, targetAudience = 'general') {
    try {
      const prompt = `
        Optimize this image prompt for maximum viral potential on social media:
        "${originalPrompt}"
        
        Target audience: ${targetAudience}
        
        Improvements to make:
        1. Add viral elements (cute, funny, relatable, surprising)
        2. Include specific visual details that catch attention
        3. Optimize for Japanese social media preferences
        4. Add artistic style that enhances shareability
        5. Keep the core concept but make it more engaging
        
        Return the optimized prompt and explain the changes made.
        
        Format:
        {
          "optimized_prompt": "improved prompt",
          "original_prompt": "${originalPrompt}",
          "changes_made": ["change1", "change2"],
          "viral_elements_added": ["element1", "element2"],
          "expected_improvement": "percentage or description"
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
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        optimized_prompt: originalPrompt,
        original_prompt: originalPrompt,
        changes_made: [],
        viral_elements_added: [],
        expected_improvement: "No optimization applied"
      };

    } catch (error) {
      console.error('Failed to optimize prompt:', error);
      return {
        optimized_prompt: originalPrompt,
        original_prompt: originalPrompt,
        changes_made: [],
        viral_elements_added: [],
        expected_improvement: "Optimization failed"
      };
    }
  }

  /**
   * Generate prompts for specific content types
   */
  async generateContentTypePrompts(contentType, trends, count = 5) {
    const contentTypePrompts = {
      meme: "Create meme-worthy image prompts that are funny and shareable",
      cute: "Create adorable and heartwarming image prompts",
      aesthetic: "Create visually stunning and aesthetic image prompts",
      relatable: "Create relatable everyday situation image prompts",
      trending: "Create prompts that capitalize on current trends",
      seasonal: "Create seasonal and timely image prompts",
      anime: "Create anime-style image prompts popular in Japanese culture",
      food: "Create mouth-watering food image prompts",
      lifestyle: "Create aspirational lifestyle image prompts",
      art: "Create artistic and creative image prompts"
    };

    const baseInstruction = contentTypePrompts[contentType] || contentTypePrompts.trending;
    
    try {
      const prompt = `
        ${baseInstruction} based on these trending topics:
        ${trends.slice(0, 5).map(t => `- ${t.keyword} (${t.category})`).join('\n')}
        
        Create ${count} prompts that:
        1. Are optimized for ${contentType} content
        2. Incorporate trending keywords naturally
        3. Are highly shareable on social media
        4. Appeal to Japanese audiences
        5. Include specific visual and artistic details
        
        Return as JSON array with format:
        [{"prompt": "detailed prompt", "keywords": ["keyword1"], "viral_score": 1-10}]
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
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const prompts = JSON.parse(jsonMatch[0]);
        return prompts.map(p => ({
          ...p,
          id: this.generatePromptId(),
          content_type: contentType,
          created_at: new Date().toISOString()
        }));
      }

      return [];
    } catch (error) {
      console.error(`Failed to generate ${contentType} prompts:`, error);
      return [];
    }
  }

  /**
   * Calculate viral score for a prompt
   */
  calculateViralScore(prompt, trends) {
    let score = prompt.estimated_engagement || 5;
    
    // Boost score based on trending keywords usage
    const trendBoost = prompt.keywords.reduce((boost, keyword) => {
      const matchingTrend = trends.find(t => 
        t.keyword.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(t.keyword.toLowerCase())
      );
      return boost + (matchingTrend ? Math.min(matchingTrend.volume / 1000, 3) : 0);
    }, 0);
    
    score += trendBoost;
    
    // Boost for viral elements
    const viralElements = prompt.viral_elements || [];
    score += viralElements.length * 0.5;
    
    // Cap at 10
    return Math.min(score, 10);
  }

  /**
   * Get fallback prompts when AI generation fails
   */
  getFallbackPrompts(trends) {
    const fallbackTemplates = [
      "A cute {animal} wearing {accessory} in {style} style",
      "Beautiful {season} scene with {element} in {art_style}",
      "Funny {character} doing {activity} in {setting}",
      "Aesthetic {object} with {color} theme in {style}",
      "Adorable {pet} with {expression} in {environment}"
    ];

    const animals = ['cat', 'dog', 'rabbit', 'panda', 'fox'];
    const accessories = ['hat', 'glasses', 'scarf', 'bow tie', 'crown'];
    const styles = ['anime', 'kawaii', 'minimalist', 'watercolor', 'digital art'];
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    const elements = ['flowers', 'leaves', 'snow', 'rain', 'sunshine'];

    return fallbackTemplates.slice(0, 5).map((template, index) => {
      const trendKeyword = trends[index % trends.length]?.keyword || 'cute';
      
      let prompt = template
        .replace('{animal}', animals[index % animals.length])
        .replace('{accessory}', accessories[index % accessories.length])
        .replace('{style}', styles[index % styles.length])
        .replace('{season}', seasons[index % seasons.length])
        .replace('{element}', elements[index % elements.length])
        .replace('{character}', trendKeyword)
        .replace('{activity}', 'relaxing')
        .replace('{setting}', 'cozy room')
        .replace('{object}', trendKeyword)
        .replace('{color}', 'pastel')
        .replace('{pet}', animals[index % animals.length])
        .replace('{expression}', 'happy')
        .replace('{environment}', 'garden')
        .replace('{art_style}', styles[index % styles.length]);

      return {
        id: this.generatePromptId(),
        prompt: prompt,
        keywords: [trendKeyword],
        style: styles[index % styles.length],
        viral_elements: ['cute', 'relatable'],
        target_audience: 'general',
        estimated_engagement: 6,
        created_at: new Date().toISOString(),
        score: 6,
        content_type: 'fallback'
      };
    });
  }

  /**
   * Store successful prompts for learning
   */
  async storeSuccessfulPrompt(promptData, performanceMetrics) {
    try {
      const data = {
        ...promptData,
        performance: performanceMetrics,
        stored_at: new Date().toISOString()
      };

      await this.env.CACHE.put(
        `successful_prompt_${promptData.id}`,
        JSON.stringify(data),
        { expirationTtl: 86400 * 30 } // 30 days
      );

      // Also store in database if available
      if (this.env.DB) {
        const stmt = this.env.DB.prepare(`
          INSERT INTO successful_prompts (
            id, prompt, keywords, performance_score, created_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        await stmt.bind(
          promptData.id,
          promptData.prompt,
          JSON.stringify(promptData.keywords),
          performanceMetrics.engagement_score || 0,
          promptData.created_at,
          JSON.stringify(data)
        ).run();
      }

    } catch (error) {
      console.error('Failed to store successful prompt:', error);
    }
  }

  /**
   * Get prompt performance analytics
   */
  async getPromptAnalytics(timeframe = '7d') {
    try {
      // Get successful prompts from cache/database
      const analytics = {
        total_prompts: 0,
        successful_prompts: 0,
        average_engagement: 0,
        top_keywords: [],
        best_performing_styles: [],
        trends_analysis: {}
      };

      // This would query the database for analytics
      // For now, return mock data
      return analytics;

    } catch (error) {
      console.error('Failed to get prompt analytics:', error);
      return null;
    }
  }

  /**
   * Generate unique prompt ID
   */
  generatePromptId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `prompt_${timestamp}_${random}`;
  }
}