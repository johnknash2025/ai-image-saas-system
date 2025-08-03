/**
 * Twitter API Service
 * Handles Twitter API v2 interactions
 */

export class TwitterAPI {
  constructor(env) {
    this.env = env;
    this.apiKey = env.TWITTER_API_KEY;
    this.apiSecret = env.TWITTER_API_SECRET;
    this.accessToken = env.TWITTER_ACCESS_TOKEN;
    this.accessTokenSecret = env.TWITTER_ACCESS_TOKEN_SECRET;
    this.bearerToken = env.TWITTER_BEARER_TOKEN;
  }

  /**
   * Post image with text to Twitter
   */
  async postImageWithText(imageData, text, hashtags = []) {
    try {
      // First, upload the image
      const mediaId = await this.uploadMedia(imageData);
      
      // Then create the tweet with the image
      const tweetText = this.formatTweetText(text, hashtags);
      const tweet = await this.createTweet(tweetText, mediaId);
      
      return tweet;
    } catch (error) {
      console.error('Failed to post image with text:', error);
      throw error;
    }
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(imageData) {
    try {
      // Convert ArrayBuffer to base64
      const base64Image = this.arrayBufferToBase64(imageData);
      
      // Upload media using Twitter API v1.1 (media upload endpoint)
      const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': await this.getOAuth1Header('POST', 'https://upload.twitter.com/1.1/media/upload.json'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'media_data': base64Image,
          'media_category': 'tweet_image'
        })
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        throw new Error(`Media upload failed: ${uploadResponse.status} - ${errorData}`);
      }

      const uploadData = await uploadResponse.json();
      return uploadData.media_id_string;

    } catch (error) {
      console.error('Media upload failed:', error);
      throw error;
    }
  }

  /**
   * Create tweet with optional media
   */
  async createTweet(text, mediaId = null) {
    try {
      const tweetData = { text };
      
      if (mediaId) {
        tweetData.media = { media_ids: [mediaId] };
      }

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tweetData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Tweet creation failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const responseData = await response.json();
      return responseData.data;

    } catch (error) {
      console.error('Tweet creation failed:', error);
      throw error;
    }
  }

  /**
   * Get tweet analytics
   */
  async getTweetAnalytics(tweetId) {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,created_at`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get tweet analytics: ${response.status}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Failed to get tweet analytics:', error);
      return null;
    }
  }

  /**
   * Search recent tweets for trend analysis
   */
  async searchTweets(query, maxResults = 100) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodedQuery}&max_results=${maxResults}&tweet.fields=public_metrics,created_at,author_id`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Tweet search failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];

    } catch (error) {
      console.error('Tweet search failed:', error);
      return [];
    }
  }

  /**
   * Get user timeline for analysis
   */
  async getUserTimeline(userId, maxResults = 100) {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=public_metrics,created_at`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get user timeline: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];

    } catch (error) {
      console.error('Failed to get user timeline:', error);
      return [];
    }
  }

  /**
   * Format tweet text with hashtags
   */
  formatTweetText(text, hashtags = []) {
    let formattedText = text || '';
    
    // Add hashtags if provided
    if (hashtags && hashtags.length > 0) {
      const hashtagString = hashtags
        .filter(tag => tag && tag.trim())
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      
      if (hashtagString) {
        formattedText += formattedText ? `\n\n${hashtagString}` : hashtagString;
      }
    }

    // Ensure tweet is within character limit (280 characters)
    if (formattedText.length > 280) {
      const maxTextLength = 280 - (hashtags.length > 0 ? hashtagString.length + 3 : 0);
      formattedText = text.substring(0, maxTextLength - 3) + '...';
      
      if (hashtags.length > 0) {
        formattedText += `\n\n${hashtagString}`;
      }
    }

    return formattedText;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Generate OAuth 1.0a header for media upload
   * Note: This is a simplified version. In production, use a proper OAuth library
   */
  async getOAuth1Header(method, url, params = {}) {
    // This is a simplified OAuth 1.0a implementation
    // In production, you should use a proper OAuth library
    
    const oauthParams = {
      oauth_consumer_key: this.apiKey,
      oauth_token: this.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: Math.random().toString(36).substring(2, 15),
      oauth_version: '1.0'
    };

    // Combine OAuth params with request params
    const allParams = { ...oauthParams, ...params };
    
    // Create parameter string
    const paramString = Object.keys(allParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    // Create signature base string
    const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    
    // Create signing key
    const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(this.accessTokenSecret)}`;
    
    // Generate signature (simplified - in production use proper HMAC-SHA1)
    const signature = await this.hmacSha1(signatureBaseString, signingKey);
    
    oauthParams.oauth_signature = signature;

    // Create authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    return authHeader;
  }

  /**
   * Simple HMAC-SHA1 implementation using Web Crypto API
   */
  async hmacSha1(message, key) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Validate Twitter API credentials
   */
  async validateCredentials() {
    try {
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Credential validation failed:', error);
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus() {
    try {
      const response = await fetch('https://api.twitter.com/1.1/application/rate_limit_status.json', {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Rate limit check failed: ${response.status}`);
      }

      const data = await response.json();
      return data.resources;

    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return null;
    }
  }
}