/**
 * Trend Analyzer Service
 * Analyzes Twitter trends and viral content patterns
 */

export class TrendAnalyzer {
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
      
      // Cache trends for 30 minutes
      await this.env.CACHE.put(
        'current_trends',
        JSON.stringify(combinedTrends),
        { expirationTtl: 1800 }
      );

      return combinedTrends;
    } catch (error) {
      console.error('Error getting trends:', error);
      
      // Return cached trends if available
      const cachedTrends = await this.env.CACHE.get('current_trends');
      if (cachedTrends) {
        return JSON.parse(cachedTrends);
      }
      
      // Fallback to default trends
      return this.getDefaultTrends();
    }
  }

  /**
   * Get Twitter trending topics
   */
  async getTwitterTrends() {
    if (!this.twitterBearerToken) {
      console.warn('Twitter Bearer Token not configured');
      return [];
    }

    try {
      // Get trending topics for Japan (WOEID: 23424856)
      const response = await fetch(
        'https://api.twitter.com/1.1/trends/place.json?id=23424856',
        {
          headers: {
            'Authorization': `Bearer ${this.twitterBearerToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      const trends = data[0]?.trends || [];

      return trends
        .filter(trend => !trend.name.startsWith('#')) // Filter out hashtags for now
        .slice(0, 10)
        .map(trend => ({
          keyword: trend.name,
          volume: trend.tweet_volume || 0,
          source: 'twitter',
          category: 'trending'
        }));
    } catch (error) {
      console.error('Twitter trends error:', error);
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
          max_tokens: 500
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
        const keywords = JSON.parse(jsonMatch[0]);
        return keywords.map(k => ({
          keyword: k.keyword,
          volume: k.viral_potential * 1000,
          source: 'ai_analysis',
          category: k.category
        }));
      }

      return [];
    } catch (error) {
      console.error('Viral keywords error:', error);
      return [];
    }
  }

  /**
   * Get seasonal and time-based trends
   */
  async getSeasonalTrends() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();

    const seasonalKeywords = [];

    // Seasonal trends
    const seasonalMap = {
      1: ['新年', '初詣', '福袋', 'お正月'],
      2: ['バレンタイン', '節分', '梅'],
      3: ['ひな祭り', '卒業', '桜', '春'],
      4: ['入学', '新生活', '桜満開', 'お花見'],
      5: ['ゴールデンウィーク', 'こどもの日', '新緑'],
      6: ['梅雨', '紫陽花', 'ジューンブライド'],
      7: ['七夕', '夏祭り', '海', 'かき氷'],
      8: ['夏休み', '花火', 'お盆', '甲子園'],
      9: ['秋', '月見', '紅葉', '新学期'],
      10: ['ハロウィン', '運動会', '秋祭り'],
      11: ['紅葉', '七五三', 'ボジョレー'],
      12: ['クリスマス', '忘年会', '年末', 'イルミネーション']
    };

    if (seasonalMap[month]) {
      seasonalKeywords.push(...seasonalMap[month].map(keyword => ({
        keyword,
        volume: 5000,
        source: 'seasonal',
        category: 'seasonal'
      })));
    }

    // Time-based trends
    if (hour >= 6 && hour <= 9) {
      seasonalKeywords.push({ keyword: '朝活', volume: 3000, source: 'time_based', category: 'lifestyle' });
    } else if (hour >= 12 && hour <= 14) {
      seasonalKeywords.push({ keyword: 'ランチ', volume: 4000, source: 'time_based', category: 'food' });
    } else if (hour >= 18 && hour <= 22) {
      seasonalKeywords.push({ keyword: '夜景', volume: 3500, source: 'time_based', category: 'lifestyle' });
    }

    return seasonalKeywords;
  }

  /**
   * Combine trends from different sources and rank them
   */
  combineTrends(twitterTrends, viralKeywords, seasonalTrends) {
    const allTrends = [...twitterTrends, ...viralKeywords, ...seasonalTrends];
    
    // Remove duplicates and combine volumes
    const trendMap = new Map();
    
    allTrends.forEach(trend => {
      const key = trend.keyword.toLowerCase();
      if (trendMap.has(key)) {
        const existing = trendMap.get(key);
        existing.volume += trend.volume;
        existing.sources = [...new Set([...existing.sources, trend.source])];
      } else {
        trendMap.set(key, {
          ...trend,
          sources: [trend.source]
        });
      }
    });

    // Sort by volume and return top trends
    return Array.from(trendMap.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);
  }

  /**
   * Get default trends when APIs are unavailable
   */
  getDefaultTrends() {
    return [
      { keyword: 'AI', volume: 10000, source: 'default', category: 'technology' },
      { keyword: 'アニメ', volume: 8000, source: 'default', category: 'anime' },
      { keyword: 'ゲーム', volume: 7000, source: 'default', category: 'gaming' },
      { keyword: 'グルメ', volume: 6000, source: 'default', category: 'food' },
      { keyword: 'ファッション', volume: 5000, source: 'default', category: 'lifestyle' },
      { keyword: '旅行', volume: 4500, source: 'default', category: 'lifestyle' },
      { keyword: 'ペット', volume: 4000, source: 'default', category: 'lifestyle' },
      { keyword: '映画', volume: 3500, source: 'default', category: 'entertainment' },
      { keyword: '音楽', volume: 3000, source: 'default', category: 'entertainment' },
      { keyword: 'スポーツ', volume: 2500, source: 'default', category: 'sports' }
    ];
  }

  /**
   * Analyze trend sentiment and viral potential
   */
  async analyzeTrendSentiment(trends) {
    try {
      const prompt = `
        Analyze the viral potential and sentiment of these trending keywords for social media content:
        ${trends.map(t => t.keyword).join(', ')}
        
        For each keyword, provide:
        1. Viral potential score (1-10)
        2. Sentiment (positive/neutral/negative)
        3. Best content type (image/video/text)
        4. Target audience
        
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
          temperature: 0.3,
          max_tokens: 1000
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
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return trends.map(t => ({
        keyword: t.keyword,
        viral_potential: 5,
        sentiment: 'neutral',
        content_type: 'image',
        target_audience: 'general'
      }));
    }
  }
}