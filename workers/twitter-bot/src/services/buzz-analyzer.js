/**
 * Buzz Analyzer Service
 * Analyzes optimal timing for viral content posting
 */

import { TwitterAPI } from './twitter-api.js';

export class BuzzAnalyzer {
  constructor(env) {
    this.env = env;
    this.twitterAPI = new TwitterAPI(env);
    this.openaiApiKey = env.OPENAI_API_KEY;
    this.optimalHours = (env.OPTIMAL_POSTING_HOURS || '9,12,18,21').split(',').map(h => parseInt(h));
  }

  /**
   * Analyze current buzz timing and trends
   */
  async analyzeBuzzTiming() {
    try {
      const [
        currentActivity,
        trendingTopics,
        competitorActivity,
        historicalData
      ] = await Promise.all([
        this.getCurrentTwitterActivity(),
        this.getTrendingTopics(),
        this.analyzeCompetitorActivity(),
        this.getHistoricalPerformance()
      ]);

      const analysis = {
        current_activity: currentActivity,
        trending_topics: trendingTopics,
        competitor_activity: competitorActivity,
        historical_performance: historicalData,
        optimal_posting_score: this.calculateOptimalScore(currentActivity, trendingTopics),
        recommendation: this.generateRecommendation(currentActivity, trendingTopics),
        next_optimal_times: await this.predictNextOptimalTimes(),
        timestamp: new Date().toISOString()
      };

      // Cache analysis for 15 minutes
      await this.env.CACHE.put(
        'buzz_analysis',
        JSON.stringify(analysis),
        { expirationTtl: 900 }
      );

      return analysis;

    } catch (error) {
      console.error('Buzz timing analysis failed:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Check if current time is optimal for posting
   */
  async isOptimalPostingTime() {
    try {
      const now = new Date();
      const jstHour = (now.getUTCHours() + 9) % 24; // Convert to JST
      const dayOfWeek = now.getUTCDay();

      // Check if it's within optimal hours
      if (!this.optimalHours.includes(jstHour)) {
        return false;
      }

      // Avoid posting on very early morning or late night
      if (jstHour < 6 || jstHour > 23) {
        return false;
      }

      // Get current buzz analysis
      const analysis = await this.analyzeBuzzTiming();
      
      // Check if optimal score is above threshold
      return analysis.optimal_posting_score >= 6;

    } catch (error) {
      console.error('Failed to check optimal posting time:', error);
      
      // Fallback to basic time check
      const now = new Date();
      const jstHour = (now.getUTCHours() + 9) % 24;
      return this.optimalHours.includes(jstHour);
    }
  }

  /**
   * Get optimal posting times for the next 24 hours
   */
  async getOptimalPostingTimes() {
    try {
      const now = new Date();
      const optimalTimes = [];

      // Generate next 24 hours of potential posting times
      for (let i = 0; i < 24; i++) {
        const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
        const jstHour = (futureTime.getUTCHours() + 9) % 24;
        
        if (this.optimalHours.includes(jstHour)) {
          const score = await this.predictOptimalScore(futureTime);
          
          optimalTimes.push({
            time: futureTime.toISOString(),
            hour_jst: jstHour,
            predicted_score: score,
            day_of_week: futureTime.getUTCDay(),
            recommended: score >= 7
          });
        }
      }

      // Sort by predicted score
      return optimalTimes.sort((a, b) => b.predicted_score - a.predicted_score);

    } catch (error) {
      console.error('Failed to get optimal posting times:', error);
      return this.getDefaultOptimalTimes();
    }
  }

  /**
   * Analyze current Twitter activity levels
   */
  async getCurrentTwitterActivity() {
    try {
      // Search for recent tweets with popular hashtags
      const popularHashtags = ['#AI', '#アニメ', '#ゲーム', '#グルメ', '#ファッション'];
      const activityData = [];

      for (const hashtag of popularHashtags) {
        const tweets = await this.twitterAPI.searchTweets(`${hashtag} -is:retweet`, 10);
        
        if (tweets.length > 0) {
          const avgEngagement = tweets.reduce((sum, tweet) => {
            const metrics = tweet.public_metrics || {};
            return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0);
          }, 0) / tweets.length;

          activityData.push({
            hashtag,
            tweet_count: tweets.length,
            avg_engagement: avgEngagement,
            recent_activity: tweets.length >= 8 ? 'high' : tweets.length >= 5 ? 'medium' : 'low'
          });
        }
      }

      const overallActivity = this.calculateOverallActivity(activityData);

      return {
        hashtag_activity: activityData,
        overall_activity_level: overallActivity,
        activity_score: this.calculateActivityScore(activityData),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to get current Twitter activity:', error);
      return {
        hashtag_activity: [],
        overall_activity_level: 'medium',
        activity_score: 5,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get trending topics for timing analysis
   */
  async getTrendingTopics() {
    try {
      // This would ideally use Twitter Trends API, but we'll simulate with search
      const trendingQueries = [
        'トレンド lang:ja',
        '話題 lang:ja',
        'バズ lang:ja',
        '人気 lang:ja'
      ];

      const trendingData = [];

      for (const query of trendingQueries) {
        const tweets = await this.twitterAPI.searchTweets(query, 20);
        
        // Extract common words/phrases from tweets
        const commonTerms = this.extractCommonTerms(tweets);
        trendingData.push(...commonTerms);
      }

      // Deduplicate and rank by frequency
      const trendMap = new Map();
      trendingData.forEach(term => {
        trendMap.set(term.text, (trendMap.get(term.text) || 0) + term.frequency);
      });

      const trends = Array.from(trendMap.entries())
        .map(([text, frequency]) => ({ text, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      return {
        trends,
        trend_strength: trends.length > 0 ? trends[0].frequency : 0,
        trending_score: Math.min(trends.reduce((sum, t) => sum + t.frequency, 0) / 10, 10)
      };

    } catch (error) {
      console.error('Failed to get trending topics:', error);
      return {
        trends: [],
        trend_strength: 0,
        trending_score: 5
      };
    }
  }

  /**
   * Analyze competitor posting activity
   */
  async analyzeCompetitorActivity() {
    try {
      // This would analyze competitor accounts in a real implementation
      // For now, we'll return simulated data
      
      const competitorData = {
        active_competitors: Math.floor(Math.random() * 10) + 5,
        avg_posting_frequency: Math.random() * 5 + 2,
        competition_level: 'medium',
        recommended_strategy: 'post_during_low_competition'
      };

      return competitorData;

    } catch (error) {
      console.error('Failed to analyze competitor activity:', error);
      return {
        active_competitors: 7,
        avg_posting_frequency: 3,
        competition_level: 'medium',
        recommended_strategy: 'post_during_low_competition'
      };
    }
  }

  /**
   * Get historical performance data
   */
  async getHistoricalPerformance() {
    try {
      // Query database for historical post performance
      const stmt = this.env.DB.prepare(`
        SELECT 
          strftime('%H', posted_at) as hour,
          strftime('%w', posted_at) as day_of_week,
          AVG(engagement_score) as avg_engagement,
          COUNT(*) as post_count
        FROM twitter_posts 
        WHERE posted_at >= datetime('now', '-30 days')
        GROUP BY hour, day_of_week
        ORDER BY avg_engagement DESC
      `);

      const results = await stmt.all();
      
      const performanceData = results.results.map(row => ({
        hour: parseInt(row.hour),
        day_of_week: parseInt(row.day_of_week),
        avg_engagement: row.avg_engagement || 0,
        post_count: row.post_count || 0
      }));

      return {
        best_performing_hours: performanceData.slice(0, 5),
        worst_performing_hours: performanceData.slice(-3),
        overall_avg_engagement: performanceData.reduce((sum, p) => sum + p.avg_engagement, 0) / performanceData.length || 0
      };

    } catch (error) {
      console.error('Failed to get historical performance:', error);
      return {
        best_performing_hours: [],
        worst_performing_hours: [],
        overall_avg_engagement: 0
      };
    }
  }

  /**
   * Calculate optimal posting score (1-10)
   */
  calculateOptimalScore(currentActivity, trendingTopics) {
    let score = 5; // Base score

    // Activity level boost
    if (currentActivity.activity_score >= 7) {
      score += 2;
    } else if (currentActivity.activity_score >= 5) {
      score += 1;
    }

    // Trending topics boost
    if (trendingTopics.trending_score >= 7) {
      score += 2;
    } else if (trendingTopics.trending_score >= 5) {
      score += 1;
    }

    // Time-based adjustments
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    
    if (this.optimalHours.includes(jstHour)) {
      score += 1;
    }

    // Weekend adjustment
    const dayOfWeek = now.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      score += 0.5; // Slight boost for weekends
    }

    return Math.min(Math.max(score, 1), 10);
  }

  /**
   * Generate posting recommendation
   */
  generateRecommendation(currentActivity, trendingTopics) {
    const score = this.calculateOptimalScore(currentActivity, trendingTopics);
    
    if (score >= 8) {
      return {
        action: 'post_now',
        message: 'Excellent time to post! High activity and strong trends detected.',
        confidence: 'high'
      };
    } else if (score >= 6) {
      return {
        action: 'consider_posting',
        message: 'Good time to post. Moderate activity levels detected.',
        confidence: 'medium'
      };
    } else {
      return {
        action: 'wait',
        message: 'Consider waiting for better timing. Low activity detected.',
        confidence: 'low'
      };
    }
  }

  /**
   * Predict optimal score for future time
   */
  async predictOptimalScore(futureTime) {
    const jstHour = (futureTime.getUTCHours() + 9) % 24;
    const dayOfWeek = futureTime.getUTCDay();
    
    let score = 5;

    // Hour-based scoring
    if (this.optimalHours.includes(jstHour)) {
      score += 2;
    }

    // Peak hours bonus
    if ([12, 18, 21].includes(jstHour)) {
      score += 1;
    }

    // Weekend bonus
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      score += 0.5;
    }

    // Add some randomness for trend variations
    score += (Math.random() - 0.5) * 2;

    return Math.min(Math.max(score, 1), 10);
  }

  /**
   * Extract common terms from tweets
   */
  extractCommonTerms(tweets) {
    const terms = [];
    const commonWords = new Set(['の', 'に', 'は', 'を', 'が', 'で', 'と', 'から', 'まで', 'より']);

    tweets.forEach(tweet => {
      if (tweet.text) {
        const words = tweet.text.split(/\s+/)
          .filter(word => word.length > 1 && !commonWords.has(word))
          .filter(word => !word.startsWith('@') && !word.startsWith('#'))
          .slice(0, 3); // Take first 3 meaningful words

        words.forEach(word => {
          terms.push({ text: word, frequency: 1 });
        });
      }
    });

    return terms;
  }

  /**
   * Calculate overall activity level
   */
  calculateOverallActivity(activityData) {
    if (activityData.length === 0) return 'low';
    
    const highCount = activityData.filter(d => d.recent_activity === 'high').length;
    const mediumCount = activityData.filter(d => d.recent_activity === 'medium').length;
    
    if (highCount >= 3) return 'high';
    if (highCount >= 1 || mediumCount >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate activity score (1-10)
   */
  calculateActivityScore(activityData) {
    if (activityData.length === 0) return 3;
    
    const avgEngagement = activityData.reduce((sum, d) => sum + d.avg_engagement, 0) / activityData.length;
    const avgTweetCount = activityData.reduce((sum, d) => sum + d.tweet_count, 0) / activityData.length;
    
    let score = 5;
    score += Math.min(avgEngagement / 100, 3); // Engagement boost
    score += Math.min(avgTweetCount / 2, 2); // Activity boost
    
    return Math.min(Math.max(score, 1), 10);
  }

  /**
   * Get fallback analysis when APIs fail
   */
  getFallbackAnalysis() {
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    
    return {
      current_activity: {
        hashtag_activity: [],
        overall_activity_level: 'medium',
        activity_score: 5,
        timestamp: now.toISOString()
      },
      trending_topics: {
        trends: [],
        trend_strength: 0,
        trending_score: 5
      },
      competitor_activity: {
        active_competitors: 7,
        avg_posting_frequency: 3,
        competition_level: 'medium'
      },
      historical_performance: {
        best_performing_hours: [],
        worst_performing_hours: [],
        overall_avg_engagement: 0
      },
      optimal_posting_score: this.optimalHours.includes(jstHour) ? 6 : 4,
      recommendation: {
        action: this.optimalHours.includes(jstHour) ? 'consider_posting' : 'wait',
        message: 'Using fallback analysis due to API limitations.',
        confidence: 'low'
      },
      next_optimal_times: this.getDefaultOptimalTimes(),
      timestamp: now.toISOString()
    };
  }

  /**
   * Get default optimal times when prediction fails
   */
  getDefaultOptimalTimes() {
    const now = new Date();
    const times = [];

    this.optimalHours.forEach(hour => {
      const nextTime = new Date(now);
      nextTime.setUTCHours(hour - 9, 0, 0, 0); // Convert JST to UTC
      
      if (nextTime <= now) {
        nextTime.setUTCDate(nextTime.getUTCDate() + 1);
      }

      times.push({
        time: nextTime.toISOString(),
        hour_jst: hour,
        predicted_score: 6,
        day_of_week: nextTime.getUTCDay(),
        recommended: true
      });
    });

    return times.sort((a, b) => new Date(a.time) - new Date(b.time));
  }
}