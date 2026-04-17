var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-3S7pS4/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-3S7pS4/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/services/trend-analyzer.js
var TrendAnalyzer = class {
  static {
    __name(this, "TrendAnalyzer");
  }
  constructor(env) {
    this.env = env;
    this.twitterBearerToken = env.TWITTER_BEARER_TOKEN;
    this.openaiApiKey = env.OPENAI_API_KEY;
  }
  /**
   * Get current trending topics from multiple sources
   */
  async getCurrentTrends() {
    try {
      const [twitterTrends, viralKeywords, seasonalTrends] = await Promise.all([
        this.getTwitterTrends(),
        this.getViralKeywords(),
        this.getSeasonalTrends()
      ]);
      const combinedTrends = this.combineTrends(twitterTrends, viralKeywords, seasonalTrends);
      await this.env.CACHE.put(
        "current_trends",
        JSON.stringify(combinedTrends),
        { expirationTtl: 1800 }
      );
      return combinedTrends;
    } catch (error) {
      console.error("Error getting trends:", error);
      const cachedTrends = await this.env.CACHE.get("current_trends");
      if (cachedTrends) {
        return JSON.parse(cachedTrends);
      }
      return this.getDefaultTrends();
    }
  }
  /**
   * Get Twitter trending topics
   */
  async getTwitterTrends() {
    if (!this.twitterBearerToken) {
      console.warn("Twitter Bearer Token not configured");
      return [];
    }
    try {
      const response = await fetch(
        "https://api.twitter.com/1.1/trends/place.json?id=23424856",
        {
          headers: {
            "Authorization": `Bearer ${this.twitterBearerToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }
      const data = await response.json();
      const trends = data[0]?.trends || [];
      return trends.filter((trend) => !trend.name.startsWith("#")).slice(0, 10).map((trend) => ({
        keyword: trend.name,
        volume: trend.tweet_volume || 0,
        source: "twitter",
        category: "trending"
      }));
    } catch (error) {
      console.error("Twitter trends error:", error);
      return [];
    }
  }
  /**
   * Get viral keywords using AI analysis
   */
  async getViralKeywords() {
    try {
      const prompt = `
        Generate a list of 10 trending keywords that are likely to go viral on social media in Japan today.
        Consider current events, seasonal topics, pop culture, and internet trends.
        
        Return as JSON array with format:
        [{"keyword": "keyword", "category": "category", "viral_potential": 1-10}]
        
        Categories: anime, gaming, food, technology, entertainment, lifestyle, memes, seasonal
      `;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const keywords = JSON.parse(jsonMatch[0]);
        return keywords.map((k) => ({
          keyword: k.keyword,
          volume: k.viral_potential * 1e3,
          source: "ai_analysis",
          category: k.category
        }));
      }
      return [];
    } catch (error) {
      console.error("Viral keywords error:", error);
      return [];
    }
  }
  /**
   * Get seasonal and time-based trends
   */
  async getSeasonalTrends() {
    const now = /* @__PURE__ */ new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const seasonalKeywords = [];
    const seasonalMap = {
      1: ["\u65B0\u5E74", "\u521D\u8A63", "\u798F\u888B", "\u304A\u6B63\u6708"],
      2: ["\u30D0\u30EC\u30F3\u30BF\u30A4\u30F3", "\u7BC0\u5206", "\u6885"],
      3: ["\u3072\u306A\u796D\u308A", "\u5352\u696D", "\u685C", "\u6625"],
      4: ["\u5165\u5B66", "\u65B0\u751F\u6D3B", "\u685C\u6E80\u958B", "\u304A\u82B1\u898B"],
      5: ["\u30B4\u30FC\u30EB\u30C7\u30F3\u30A6\u30A3\u30FC\u30AF", "\u3053\u3069\u3082\u306E\u65E5", "\u65B0\u7DD1"],
      6: ["\u6885\u96E8", "\u7D2B\u967D\u82B1", "\u30B8\u30E5\u30FC\u30F3\u30D6\u30E9\u30A4\u30C9"],
      7: ["\u4E03\u5915", "\u590F\u796D\u308A", "\u6D77", "\u304B\u304D\u6C37"],
      8: ["\u590F\u4F11\u307F", "\u82B1\u706B", "\u304A\u76C6", "\u7532\u5B50\u5712"],
      9: ["\u79CB", "\u6708\u898B", "\u7D05\u8449", "\u65B0\u5B66\u671F"],
      10: ["\u30CF\u30ED\u30A6\u30A3\u30F3", "\u904B\u52D5\u4F1A", "\u79CB\u796D\u308A"],
      11: ["\u7D05\u8449", "\u4E03\u4E94\u4E09", "\u30DC\u30B8\u30E7\u30EC\u30FC"],
      12: ["\u30AF\u30EA\u30B9\u30DE\u30B9", "\u5FD8\u5E74\u4F1A", "\u5E74\u672B", "\u30A4\u30EB\u30DF\u30CD\u30FC\u30B7\u30E7\u30F3"]
    };
    if (seasonalMap[month]) {
      seasonalKeywords.push(...seasonalMap[month].map((keyword) => ({
        keyword,
        volume: 5e3,
        source: "seasonal",
        category: "seasonal"
      })));
    }
    if (hour >= 6 && hour <= 9) {
      seasonalKeywords.push({ keyword: "\u671D\u6D3B", volume: 3e3, source: "time_based", category: "lifestyle" });
    } else if (hour >= 12 && hour <= 14) {
      seasonalKeywords.push({ keyword: "\u30E9\u30F3\u30C1", volume: 4e3, source: "time_based", category: "food" });
    } else if (hour >= 18 && hour <= 22) {
      seasonalKeywords.push({ keyword: "\u591C\u666F", volume: 3500, source: "time_based", category: "lifestyle" });
    }
    return seasonalKeywords;
  }
  /**
   * Combine trends from different sources and rank them
   */
  combineTrends(twitterTrends, viralKeywords, seasonalTrends) {
    const allTrends = [...twitterTrends, ...viralKeywords, ...seasonalTrends];
    const trendMap = /* @__PURE__ */ new Map();
    allTrends.forEach((trend) => {
      const key = trend.keyword.toLowerCase();
      if (trendMap.has(key)) {
        const existing = trendMap.get(key);
        existing.volume += trend.volume;
        existing.sources = [.../* @__PURE__ */ new Set([...existing.sources, trend.source])];
      } else {
        trendMap.set(key, {
          ...trend,
          sources: [trend.source]
        });
      }
    });
    return Array.from(trendMap.values()).sort((a, b) => b.volume - a.volume).slice(0, 20);
  }
  /**
   * Get default trends when APIs are unavailable
   */
  getDefaultTrends() {
    return [
      { keyword: "AI", volume: 1e4, source: "default", category: "technology" },
      { keyword: "\u30A2\u30CB\u30E1", volume: 8e3, source: "default", category: "anime" },
      { keyword: "\u30B2\u30FC\u30E0", volume: 7e3, source: "default", category: "gaming" },
      { keyword: "\u30B0\u30EB\u30E1", volume: 6e3, source: "default", category: "food" },
      { keyword: "\u30D5\u30A1\u30C3\u30B7\u30E7\u30F3", volume: 5e3, source: "default", category: "lifestyle" },
      { keyword: "\u65C5\u884C", volume: 4500, source: "default", category: "lifestyle" },
      { keyword: "\u30DA\u30C3\u30C8", volume: 4e3, source: "default", category: "lifestyle" },
      { keyword: "\u6620\u753B", volume: 3500, source: "default", category: "entertainment" },
      { keyword: "\u97F3\u697D", volume: 3e3, source: "default", category: "entertainment" },
      { keyword: "\u30B9\u30DD\u30FC\u30C4", volume: 2500, source: "default", category: "sports" }
    ];
  }
  /**
   * Analyze trend sentiment and viral potential
   */
  async analyzeTrendSentiment(trends) {
    try {
      const prompt = `
        Analyze the viral potential and sentiment of these trending keywords for social media content:
        ${trends.map((t) => t.keyword).join(", ")}
        
        For each keyword, provide:
        1. Viral potential score (1-10)
        2. Sentiment (positive/neutral/negative)
        3. Best content type (image/video/text)
        4. Target audience
        
        Return as JSON array.
      `;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1e3
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error("Sentiment analysis error:", error);
      return trends.map((t) => ({
        keyword: t.keyword,
        viral_potential: 5,
        sentiment: "neutral",
        content_type: "image",
        target_audience: "general"
      }));
    }
  }
};

// src/services/image-generator.js
var ImageGenerator = class {
  static {
    __name(this, "ImageGenerator");
  }
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
      style = "vivid",
      size = "1024x1024",
      quality = "standard",
      metadata = {}
    } = options;
    try {
      console.log("Generating image with prompt:", prompt);
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size,
          quality,
          style,
          response_format: "url"
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message}`);
      }
      const data = await response.json();
      const imageUrl = data.data[0].url;
      const revisedPrompt = data.data[0].revised_prompt;
      const imageData = await this.downloadImage(imageUrl);
      const imageId = this.generateImageId();
      await this.imageStorage.storeImage(imageId, imageData, {
        originalPrompt: prompt,
        revisedPrompt,
        style,
        size,
        quality,
        ...metadata
      });
      await this.storeImageMetadata({
        id: imageId,
        originalPrompt: prompt,
        revisedPrompt,
        style,
        size,
        quality,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "generated",
        ...metadata
      });
      return {
        id: imageId,
        url: await this.imageStorage.getImageUrl(imageId),
        originalPrompt: prompt,
        revisedPrompt,
        metadata: {
          style,
          size,
          quality,
          generatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    } catch (error) {
      console.error("Image generation failed:", error);
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
            basePrompt
          }
        });
      } catch (error) {
        console.error(`Failed to generate variation ${index}:`, error);
        return null;
      }
    });
    const results = await Promise.all(generationPromises);
    return results.filter((result) => result !== null);
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 500
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      const data = await response.json();
      const content = data.choices[0].message.content;
      const variations = content.split("\n").filter((line) => line.trim().length > 0).map((line) => line.replace(/^\d+\.\s*/, "").trim()).slice(0, count);
      return variations.length > 0 ? variations : [basePrompt];
    } catch (error) {
      console.error("Failed to generate prompt variations:", error);
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
      console.error("Failed to store image metadata:", error);
    }
  }
  /**
   * Get image metadata from database
   */
  async getImageMetadata(imageId) {
    try {
      const stmt = this.env.DB.prepare("SELECT * FROM images WHERE id = ?");
      const result = await stmt.bind(imageId).first();
      if (result) {
        return {
          ...result,
          metadata: JSON.parse(result.metadata || "{}")
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to get image metadata:", error);
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
      return results.results.map((row) => ({
        ...row,
        metadata: JSON.parse(row.metadata || "{}"),
        url: this.imageStorage.getImageUrl(row.id)
      }));
    } catch (error) {
      console.error("Failed to list recent images:", error);
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
      throw new Error("Prompt is required");
    }
    if (prompt.length > 4e3) {
      throw new Error("Prompt is too long (max 4000 characters)");
    }
    const validStyles = ["vivid", "natural"];
    if (style && !validStyles.includes(style)) {
      throw new Error(`Invalid style. Must be one of: ${validStyles.join(", ")}`);
    }
    const validSizes = ["1024x1024", "1792x1024", "1024x1792"];
    if (size && !validSizes.includes(size)) {
      throw new Error(`Invalid size. Must be one of: ${validSizes.join(", ")}`);
    }
    const validQualities = ["standard", "hd"];
    if (quality && !validQualities.includes(quality)) {
      throw new Error(`Invalid quality. Must be one of: ${validQualities.join(", ")}`);
    }
    return true;
  }
};

// src/services/prompt-optimizer.js
var PromptOptimizer = class {
  static {
    __name(this, "PromptOptimizer");
  }
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
        ${topTrends.map((t) => `- ${t.keyword} (${t.category}, volume: ${t.volume})`).join("\n")}
        
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 2e3
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
        return prompts.map((p, index) => ({
          ...p,
          id: this.generatePromptId(),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          trends_used: topTrends.filter(
            (t) => p.keywords.some((k) => k.toLowerCase().includes(t.keyword.toLowerCase()))
          ),
          score: this.calculateViralScore(p, topTrends)
        }));
      }
      return [];
    } catch (error) {
      console.error("Failed to generate viral prompts:", error);
      return this.getFallbackPrompts(trends);
    }
  }
  /**
   * Optimize existing prompt for better viral potential
   */
  async optimizePrompt(originalPrompt, targetAudience = "general") {
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 800
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      const data = await response.json();
      const content = data.choices[0].message.content;
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
      console.error("Failed to optimize prompt:", error);
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
        ${trends.slice(0, 5).map((t) => `- ${t.keyword} (${t.category})`).join("\n")}
        
        Create ${count} prompts that:
        1. Are optimized for ${contentType} content
        2. Incorporate trending keywords naturally
        3. Are highly shareable on social media
        4. Appeal to Japanese audiences
        5. Include specific visual and artistic details
        
        Return as JSON array with format:
        [{"prompt": "detailed prompt", "keywords": ["keyword1"], "viral_score": 1-10}]
      `;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
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
        return prompts.map((p) => ({
          ...p,
          id: this.generatePromptId(),
          content_type: contentType,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
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
    const trendBoost = prompt.keywords.reduce((boost, keyword) => {
      const matchingTrend = trends.find(
        (t) => t.keyword.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(t.keyword.toLowerCase())
      );
      return boost + (matchingTrend ? Math.min(matchingTrend.volume / 1e3, 3) : 0);
    }, 0);
    score += trendBoost;
    const viralElements = prompt.viral_elements || [];
    score += viralElements.length * 0.5;
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
    const animals = ["cat", "dog", "rabbit", "panda", "fox"];
    const accessories = ["hat", "glasses", "scarf", "bow tie", "crown"];
    const styles = ["anime", "kawaii", "minimalist", "watercolor", "digital art"];
    const seasons = ["spring", "summer", "autumn", "winter"];
    const elements = ["flowers", "leaves", "snow", "rain", "sunshine"];
    return fallbackTemplates.slice(0, 5).map((template, index) => {
      const trendKeyword = trends[index % trends.length]?.keyword || "cute";
      let prompt = template.replace("{animal}", animals[index % animals.length]).replace("{accessory}", accessories[index % accessories.length]).replace("{style}", styles[index % styles.length]).replace("{season}", seasons[index % seasons.length]).replace("{element}", elements[index % elements.length]).replace("{character}", trendKeyword).replace("{activity}", "relaxing").replace("{setting}", "cozy room").replace("{object}", trendKeyword).replace("{color}", "pastel").replace("{pet}", animals[index % animals.length]).replace("{expression}", "happy").replace("{environment}", "garden").replace("{art_style}", styles[index % styles.length]);
      return {
        id: this.generatePromptId(),
        prompt,
        keywords: [trendKeyword],
        style: styles[index % styles.length],
        viral_elements: ["cute", "relatable"],
        target_audience: "general",
        estimated_engagement: 6,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        score: 6,
        content_type: "fallback"
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
        stored_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await this.env.CACHE.put(
        `successful_prompt_${promptData.id}`,
        JSON.stringify(data),
        { expirationTtl: 86400 * 30 }
        // 30 days
      );
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
      console.error("Failed to store successful prompt:", error);
    }
  }
  /**
   * Get prompt performance analytics
   */
  async getPromptAnalytics(timeframe = "7d") {
    try {
      const analytics = {
        total_prompts: 0,
        successful_prompts: 0,
        average_engagement: 0,
        top_keywords: [],
        best_performing_styles: [],
        trends_analysis: {}
      };
      return analytics;
    } catch (error) {
      console.error("Failed to get prompt analytics:", error);
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
};

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      switch (path) {
        case "/":
          return new Response("AI Image Generator Worker is running!", {
            headers: { ...corsHeaders, "Content-Type": "text/plain" }
          });
        case "/analyze-trends":
          return await handleTrendAnalysis(request, env);
        case "/generate-image":
          return await handleImageGeneration(request, env);
        case "/get-trending-prompts":
          return await handleGetTrendingPrompts(request, env);
        case "/scheduled-generation":
          return await handleScheduledGeneration(request, env);
        default:
          return new Response("Not Found", {
            status: 404,
            headers: corsHeaders
          });
      }
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },
  // Scheduled trigger for automatic trend analysis and image generation
  async scheduled(controller, env, ctx) {
    console.log("Running scheduled image generation...");
    try {
      const trendAnalyzer = new TrendAnalyzer(env);
      const imageGenerator = new ImageGenerator(env);
      const promptOptimizer = new PromptOptimizer(env);
      const trends = await trendAnalyzer.getCurrentTrends();
      console.log("Current trends:", trends);
      const prompts = await promptOptimizer.generateViralPrompts(trends);
      console.log("Generated prompts:", prompts);
      const generationPromises = prompts.slice(0, 3).map(async (prompt) => {
        try {
          const result = await imageGenerator.generateImage(prompt);
          console.log("Generated image:", result.id);
          return result;
        } catch (error) {
          console.error("Failed to generate image for prompt:", prompt, error);
          return null;
        }
      });
      const results = await Promise.all(generationPromises);
      const successfulGenerations = results.filter((r) => r !== null);
      console.log(`Successfully generated ${successfulGenerations.length} images`);
      await env.CACHE.put(
        `generation_stats_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
        JSON.stringify({
          timestamp: Date.now(),
          trends_analyzed: trends.length,
          prompts_generated: prompts.length,
          images_generated: successfulGenerations.length,
          successful_generations: successfulGenerations.map((r) => r.id)
        }),
        { expirationTtl: 86400 * 7 }
        // 7 days
      );
    } catch (error) {
      console.error("Scheduled generation failed:", error);
    }
  }
};
async function handleTrendAnalysis(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const trendAnalyzer = new TrendAnalyzer(env);
  const trends = await trendAnalyzer.getCurrentTrends();
  return new Response(JSON.stringify({
    success: true,
    trends,
    timestamp: Date.now()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTrendAnalysis, "handleTrendAnalysis");
async function handleImageGeneration(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const body = await request.json();
  const { prompt, style, size, quality } = body;
  if (!prompt) {
    return new Response(JSON.stringify({
      error: "Prompt is required"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const imageGenerator = new ImageGenerator(env);
  const result = await imageGenerator.generateImage({
    prompt,
    style: style || env.DEFAULT_IMAGE_STYLE,
    size: size || env.DEFAULT_IMAGE_SIZE,
    quality: quality || env.DEFAULT_IMAGE_QUALITY
  });
  return new Response(JSON.stringify({
    success: true,
    image: result
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleImageGeneration, "handleImageGeneration");
async function handleGetTrendingPrompts(request, env) {
  const promptOptimizer = new PromptOptimizer(env);
  const cachedPrompts = await env.CACHE.get("trending_prompts");
  if (cachedPrompts) {
    return new Response(cachedPrompts, {
      headers: { "Content-Type": "application/json" }
    });
  }
  const trendAnalyzer = new TrendAnalyzer(env);
  const trends = await trendAnalyzer.getCurrentTrends();
  const prompts = await promptOptimizer.generateViralPrompts(trends);
  const response = JSON.stringify({
    success: true,
    prompts,
    generated_at: Date.now()
  });
  await env.CACHE.put("trending_prompts", response, { expirationTtl: 3600 });
  return new Response(response, {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleGetTrendingPrompts, "handleGetTrendingPrompts");
async function handleScheduledGeneration(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const controller = { scheduledTime: Date.now() };
  await this.scheduled(controller, env, {});
  return new Response(JSON.stringify({
    success: true,
    message: "Scheduled generation triggered"
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleScheduledGeneration, "handleScheduledGeneration");

// ../../../../.nvm/versions/node/v22.14.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.nvm/versions/node/v22.14.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-3S7pS4/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../.nvm/versions/node/v22.14.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-3S7pS4/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
