/**
 * Twitter Bot Worker
 * Automated posting with buzz timing analysis
 */

import { TwitterAPI } from './services/twitter-api.js';
import { BuzzAnalyzer } from './services/buzz-analyzer.js';
import { ContentOptimizer } from './services/content-optimizer.js';
import { PostScheduler } from './services/post-scheduler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/':
          return new Response('Twitter Bot Worker is running!', {
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });

        case '/post-image':
          return await handlePostImage(request, env);

        case '/schedule-post':
          return await handleSchedulePost(request, env);

        case '/analyze-buzz-timing':
          return await handleBuzzAnalysis(request, env);

        case '/get-optimal-times':
          return await handleGetOptimalTimes(request, env);

        case '/post-stats':
          return await handlePostStats(request, env);

        case '/webhook':
          return await handleWebhook(request, env);

        default:
          return new Response('Not Found', { 
            status: 404,
            headers: corsHeaders 
          });
      }
    } catch (error) {
      console.error('Twitter Bot Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  // Scheduled trigger for automated posting
  async scheduled(controller, env, ctx) {
    console.log('Running scheduled Twitter posting...');
    
    try {
      const postScheduler = new PostScheduler(env);
      const buzzAnalyzer = new BuzzAnalyzer(env);

      // Check if it's an optimal time to post
      const isOptimalTime = await buzzAnalyzer.isOptimalPostingTime();
      
      if (!isOptimalTime) {
        console.log('Not an optimal posting time, skipping...');
        return;
      }

      // Get pending scheduled posts
      const pendingPosts = await postScheduler.getPendingPosts();
      
      if (pendingPosts.length === 0) {
        console.log('No pending posts to publish');
        
        // Try to generate new content if no posts are scheduled
        await generateAndScheduleContent(env);
        return;
      }

      // Post the highest priority pending post
      const postToPublish = pendingPosts[0];
      const result = await postScheduler.publishScheduledPost(postToPublish.id);
      
      if (result.success) {
        console.log('Successfully posted:', result.post_id);
      } else {
        console.error('Failed to post:', result.error);
      }

    } catch (error) {
      console.error('Scheduled posting failed:', error);
    }
  }
};

/**
 * Handle immediate image posting
 */
async function handlePostImage(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.json();
  const { imageId, caption, hashtags, scheduleTime } = body;

  if (!imageId) {
    return new Response(JSON.stringify({
      error: 'Image ID is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const twitterAPI = new TwitterAPI(env);
    const contentOptimizer = new ContentOptimizer(env);

    // Get image from R2
    const imageObject = await env.IMAGES.get(`images/${imageId}.png`);
    if (!imageObject) {
      throw new Error('Image not found');
    }

    const imageData = await imageObject.arrayBuffer();

    // Optimize caption if provided
    let optimizedCaption = caption;
    if (caption) {
      const optimization = await contentOptimizer.optimizeCaption(caption, hashtags);
      optimizedCaption = optimization.optimized_caption;
    }

    // Post to Twitter
    const result = await twitterAPI.postImageWithText(
      imageData,
      optimizedCaption,
      hashtags
    );

    // Store post analytics
    await storePostAnalytics(env, {
      post_id: result.id,
      image_id: imageId,
      caption: optimizedCaption,
      hashtags: hashtags,
      posted_at: new Date().toISOString(),
      scheduled: !!scheduleTime
    });

    return new Response(JSON.stringify({
      success: true,
      post_id: result.id,
      url: `https://twitter.com/user/status/${result.id}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to post image:', error);
    return new Response(JSON.stringify({
      error: 'Failed to post image',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle post scheduling
 */
async function handleSchedulePost(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.json();
  const { imageId, caption, hashtags, scheduleTime, priority } = body;

  if (!imageId || !scheduleTime) {
    return new Response(JSON.stringify({
      error: 'Image ID and schedule time are required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const postScheduler = new PostScheduler(env);
    const contentOptimizer = new ContentOptimizer(env);

    // Optimize content
    let optimizedCaption = caption;
    let optimizedHashtags = hashtags;

    if (caption) {
      const optimization = await contentOptimizer.optimizeCaption(caption, hashtags);
      optimizedCaption = optimization.optimized_caption;
      optimizedHashtags = optimization.optimized_hashtags;
    }

    // Schedule the post
    const scheduledPost = await postScheduler.schedulePost({
      imageId,
      caption: optimizedCaption,
      hashtags: optimizedHashtags,
      scheduleTime: new Date(scheduleTime),
      priority: priority || 5
    });

    return new Response(JSON.stringify({
      success: true,
      scheduled_post_id: scheduledPost.id,
      scheduled_time: scheduledPost.schedule_time
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to schedule post:', error);
    return new Response(JSON.stringify({
      error: 'Failed to schedule post',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle buzz timing analysis
 */
async function handleBuzzAnalysis(request, env) {
  try {
    const buzzAnalyzer = new BuzzAnalyzer(env);
    const analysis = await buzzAnalyzer.analyzeBuzzTiming();

    return new Response(JSON.stringify({
      success: true,
      analysis
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Buzz analysis failed:', error);
    return new Response(JSON.stringify({
      error: 'Buzz analysis failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle getting optimal posting times
 */
async function handleGetOptimalTimes(request, env) {
  try {
    const buzzAnalyzer = new BuzzAnalyzer(env);
    const optimalTimes = await buzzAnalyzer.getOptimalPostingTimes();

    return new Response(JSON.stringify({
      success: true,
      optimal_times: optimalTimes
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to get optimal times:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get optimal times',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle post statistics
 */
async function handlePostStats(request, env) {
  const url = new URL(request.url);
  const timeframe = url.searchParams.get('timeframe') || '7d';

  try {
    const stats = await getPostStatistics(env, timeframe);

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to get post stats:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get post stats',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle webhook for Twitter events
 */
async function handleWebhook(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    
    // Process Twitter webhook events (likes, retweets, replies)
    if (body.tweet_create_events) {
      // Handle new tweets (mentions, replies)
      for (const tweet of body.tweet_create_events) {
        await processTweetEvent(env, tweet);
      }
    }

    if (body.favorite_events) {
      // Handle likes
      for (const event of body.favorite_events) {
        await processFavoriteEvent(env, event);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook processing failed:', error);
    return new Response(JSON.stringify({
      error: 'Webhook processing failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate and schedule new content automatically
 */
async function generateAndScheduleContent(env) {
  try {
    // Call image generator to create new content
    const response = await fetch(`${env.IMAGE_GENERATOR_URL}/scheduled-generation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      console.log('Triggered content generation');
    }

  } catch (error) {
    console.error('Failed to trigger content generation:', error);
  }
}

/**
 * Store post analytics in database
 */
async function storePostAnalytics(env, postData) {
  try {
    const stmt = env.DB.prepare(`
      INSERT INTO twitter_posts (
        post_id, image_id, caption, hashtags, posted_at, scheduled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      postData.post_id,
      postData.image_id,
      postData.caption,
      JSON.stringify(postData.hashtags),
      postData.posted_at,
      postData.scheduled ? 1 : 0
    ).run();

  } catch (error) {
    console.error('Failed to store post analytics:', error);
  }
}

/**
 * Get post statistics from database
 */
async function getPostStatistics(env, timeframe) {
  try {
    const days = timeframe === '30d' ? 30 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const stmt = env.DB.prepare(`
      SELECT 
        COUNT(*) as total_posts,
        AVG(engagement_score) as avg_engagement,
        SUM(likes) as total_likes,
        SUM(retweets) as total_retweets
      FROM twitter_posts 
      WHERE posted_at >= ?
    `);

    const result = await stmt.bind(since).first();
    
    return {
      timeframe,
      total_posts: result.total_posts || 0,
      average_engagement: result.avg_engagement || 0,
      total_likes: result.total_likes || 0,
      total_retweets: result.total_retweets || 0,
      period_start: since
    };

  } catch (error) {
    console.error('Failed to get statistics:', error);
    return {
      timeframe,
      total_posts: 0,
      average_engagement: 0,
      total_likes: 0,
      total_retweets: 0,
      error: error.message
    };
  }
}

/**
 * Process tweet events from webhook
 */
async function processTweetEvent(env, tweet) {
  // Handle mentions, replies, etc.
  console.log('Processing tweet event:', tweet.id);
}

/**
 * Process favorite events from webhook
 */
async function processFavoriteEvent(env, event) {
  // Update engagement metrics
  console.log('Processing favorite event:', event.id);
}