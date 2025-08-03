import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Generic fetch wrapper
 */
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Add authorization header if needed
      // 'Authorization': `Bearer ${localStorage.getItem('token')}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(errorData.message || 'API request failed');
  }

  return response.json();
}

// --- Image Generator Endpoints ---

export const getGeneratedImages = async () => {
  // This is a placeholder. We need to implement this endpoint in the worker.
  // return apiFetch('/images');
  return Promise.resolve([]); // Returning empty array for now
};

export const generateImage = async (prompt: string) => {
  return apiFetch('/generate-image', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
};

// --- Twitter Bot Endpoints ---

export const getTwitterStats = async () => {
  return apiFetch('/twitter/stats');
};

export const scheduleTweet = async (data: { imageId: string; caption: string; scheduleTime: string }) => {
  return apiFetch('/twitter/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// --- SaaS Platform Endpoints ---

export const getProducts = async () => {
  return apiFetch('/saas/products');
};

export const createCheckoutSession = async (productId: string) => {
  return apiFetch('/saas/checkout', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
};
