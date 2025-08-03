/**
 * Post Scheduler Service
 * Manages scheduling, storing, and publishing of Twitter posts
 */

import { TwitterAPI } from './twitter-api.js';
import { ContentOptimizer } from './content-optimizer.js';

export class PostScheduler {
  constructor(env) {
    this.env = env;
    this.scheduleKV = env.SCHEDULE;
    this.db = env.DB;
    this.twitterAPI = new TwitterAPI(env);
    this.contentOptimizer = new ContentOptimizer(env);
  }

  /**
   * Schedule a new post
   */
  async schedulePost(postData) {
    const { imageId, caption, hashtags, scheduleTime, priority = 5 } = postData;
    const postId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      // Optimize content before scheduling
      const optimization = await this.contentOptimizer.optimizeContent(caption, hashtags);

      const scheduledPost = {
        id: postId,
        image_id: imageId,
        caption: optimization.optimized_caption,
        hashtags: optimization.optimized_hashtags,
        schedule_time: new Date(scheduleTime).toISOString(),
        status: 'scheduled', // scheduled, published, failed
        priority: priority, // 1-10, higher is more important
        created_at: new Date().toISOString(),
        attempts: 0
      };

      // Store in KV for quick access by the scheduled trigger
      await this.scheduleKV.put(postId, JSON.stringify(scheduledPost));

      // Store in D1 for persistence and analytics
      await this.storeScheduledPostInDB(scheduledPost);

      return scheduledPost;

    } catch (error) {
      console.error('Failed to schedule post:', error);
      throw error;
    }
  }

  /**
   * Get all pending scheduled posts, sorted by priority and time
   */
  async getPendingPosts() {
    try {
      const { keys } = await this.scheduleKV.list({ prefix: 'post_' });
      
      if (keys.length === 0) {
        return [];
      }

      const posts = await Promise.all(
        keys.map(key => this.scheduleKV.get(key.name, { type: 'json' }))
      );

      return posts
        .filter(post => post && post.status === 'scheduled')
        .sort((a, b) => {
          // Higher priority first
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          // Earlier schedule time first
          return new Date(a.schedule_time) - new Date(b.schedule_time);
        });

    } catch (error) {
      console.error('Failed to get pending posts:', error);
      return [];
    }
  }

  /**
   * Publish a scheduled post
   */
  async publishScheduledPost(postId) {
    const post = await this.scheduleKV.get(postId, { type: 'json' });

    if (!post || post.status !== 'scheduled') {
      return { success: false, error: 'Post not found or already processed' };
    }

    try {
      // Get image from R2
      const imageObject = await this.env.IMAGES.get(`images/${post.image_id}.png`);
      if (!imageObject) {
        throw new Error(`Image not found: ${post.image_id}`);
      }
      const imageData = await imageObject.arrayBuffer();

      // Post to Twitter
      const tweetResult = await this.twitterAPI.postImageWithText(
        imageData,
        post.caption,
        post.hashtags
      );

      // Update post status to 'published'
      await this.updatePostStatus(postId, 'published', { twitter_post_id: tweetResult.id });

      // Remove from KV schedule
      await this.scheduleKV.delete(postId);

      return { success: true, post_id: tweetResult.id };

    } catch (error) {
      console.error(`Failed to publish post ${postId}:`, error);
      await this.updatePostStatus(postId, 'failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Store scheduled post metadata in D1
   */
  async storeScheduledPostInDB(postData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO scheduled_posts (
          id, image_id, caption, hashtags, schedule_time, status, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        postData.id,
        postData.image_id,
        postData.caption,
        JSON.stringify(postData.hashtags),
        postData.schedule_time,
        postData.status,
        postData.priority,
        postData.created_at
      ).run();

    } catch (error) {
      console.error('Failed to store scheduled post in DB:', error);
    }
  }

  /**
   * Update post status in D1
   */
  async updatePostStatus(postId, status, details = {}) {
    try {
      const stmt = this.db.prepare(`
        UPDATE scheduled_posts
        SET status = ?, twitter_post_id = ?, error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      await stmt.bind(
        status,
        details.twitter_post_id || null,
        details.error || null,
        postId
      ).run();

    } catch (error) {
      console.error(`Failed to update post status for ${postId}:`, error);
    }
  }
}