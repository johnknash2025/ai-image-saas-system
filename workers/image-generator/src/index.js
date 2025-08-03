/**
 * AI Image Generator Worker
 * Analyzes trends and generates viral-worthy images
 */

import { TrendAnalyzer } from './services/trend-analyzer.js';
import { ImageGenerator } from './services/image-generator.js';
import { ImageStorage } from './services/image-storage.js';
import { PromptOptimizer } from './services/prompt-optimizer.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for frontend access
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
          return new Response('AI Image Generator Worker is running!', {
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });

        case '/analyze-trends':
          return await handleTrendAnalysis(request, env);

        case '/generate-image':
          return await handleImageGeneration(request, env);

        case '/get-trending-prompts':
          return await handleGetTrendingPrompts(request, env);

        case '/scheduled-generation':
          return await handleScheduledGeneration(request, env);

        default:
          return new Response('Not Found', { 
            status: 404,
            headers: corsHeaders 
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  // Scheduled trigger for automatic trend analysis and image generation
  async scheduled(controller, env, ctx) {
    console.log('Running scheduled image generation...');
    
    try {
      const trendAnalyzer = new TrendAnalyzer(env);
      const imageGenerator = new ImageGenerator(env);
      const promptOptimizer = new PromptOptimizer(env);

      // 1. Analyze current trends
      const trends = await trendAnalyzer.getCurrentTrends();
      console.log('Current trends:', trends);

      // 2. Generate optimized prompts based on trends
      const prompts = await promptOptimizer.generateViralPrompts(trends);
      console.log('Generated prompts:', prompts);

      // 3. Generate images for top prompts
      const generationPromises = prompts.slice(0, 3).map(async (prompt) => {
        try {
          const result = await imageGenerator.generateImage(prompt);
          console.log('Generated image:', result.id);
          return result;
        } catch (error) {
          console.error('Failed to generate image for prompt:', prompt, error);
          return null;
        }
      });

      const results = await Promise.all(generationPromises);
      const successfulGenerations = results.filter(r => r !== null);

      console.log(`Successfully generated ${successfulGenerations.length} images`);

      // Store generation stats
      await env.CACHE.put(
        `generation_stats_${new Date().toISOString().split('T')[0]}`,
        JSON.stringify({
          timestamp: Date.now(),
          trends_analyzed: trends.length,
          prompts_generated: prompts.length,
          images_generated: successfulGenerations.length,
          successful_generations: successfulGenerations.map(r => r.id)
        }),
        { expirationTtl: 86400 * 7 } // 7 days
      );

    } catch (error) {
      console.error('Scheduled generation failed:', error);
    }
  }
};

/**
 * Handle trend analysis request
 */
async function handleTrendAnalysis(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const trendAnalyzer = new TrendAnalyzer(env);
  const trends = await trendAnalyzer.getCurrentTrends();

  return new Response(JSON.stringify({
    success: true,
    trends,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle image generation request
 */
async function handleImageGeneration(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.json();
  const { prompt, style, size, quality } = body;

  if (!prompt) {
    return new Response(JSON.stringify({
      error: 'Prompt is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
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
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle getting trending prompts
 */
async function handleGetTrendingPrompts(request, env) {
  const promptOptimizer = new PromptOptimizer(env);
  const cachedPrompts = await env.CACHE.get('trending_prompts');

  if (cachedPrompts) {
    return new Response(cachedPrompts, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Generate new trending prompts
  const trendAnalyzer = new TrendAnalyzer(env);
  const trends = await trendAnalyzer.getCurrentTrends();
  const prompts = await promptOptimizer.generateViralPrompts(trends);

  const response = JSON.stringify({
    success: true,
    prompts,
    generated_at: Date.now()
  });

  // Cache for 1 hour
  await env.CACHE.put('trending_prompts', response, { expirationTtl: 3600 });

  return new Response(response, {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle manual scheduled generation trigger
 */
async function handleScheduledGeneration(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Trigger the same logic as scheduled event
  const controller = { scheduledTime: Date.now() };
  await this.scheduled(controller, env, {});

  return new Response(JSON.stringify({
    success: true,
    message: 'Scheduled generation triggered'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}