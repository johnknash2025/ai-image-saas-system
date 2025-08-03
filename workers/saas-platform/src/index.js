/**
 * SaaS Platform Worker
 * Handles image sales, user authentication, and payments.
 */

// Future service imports
// import { AuthService } from './services/auth-service.js';
// import { ProductService } from './services/product-service.js';
// import { PaymentService } from './services/payment-service.js';
// import { OrderService } from './services/order-service.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Simple router
    try {
      // Public routes (no auth required)
      if (path === '/') {
        return new Response('SaaS Platform Worker is running!', { headers: corsHeaders });
      }
      if (path === '/api/auth/login') {
        // return handleLogin(request, env);
        return new Response(JSON.stringify({ message: 'Login endpoint not implemented' }), { headers: corsHeaders });
      }
      if (path === '/api/auth/register') {
        // return handleRegister(request, env);
        return new Response(JSON.stringify({ message: 'Register endpoint not implemented' }), { headers: corsHeaders });
      }
      if (path.startsWith('/api/products')) {
        // return handleProducts(request, env);
        return new Response(JSON.stringify({ message: 'Products endpoint not implemented' }), { headers: corsHeaders });
      }
      if (path === '/api/stripe-webhook') {
        // return handleStripeWebhook(request, env);
        return new Response(JSON.stringify({ message: 'Stripe webhook not implemented' }), { headers: corsHeaders });
      }

      // Protected routes (auth required)
      const auth = await authenticateRequest(request, env);
      if (!auth.success) {
        return new Response(JSON.stringify({ error: auth.error }), { status: 401, headers: corsHeaders });
      }

      // Add user context to the request for downstream services
      request.user = auth.user;

      if (path === '/api/checkout/create-session') {
        // return handleCreateCheckoutSession(request, env);
        return new Response(JSON.stringify({ message: 'Checkout session endpoint not implemented' }), { headers: corsHeaders });
      }
      if (path.startsWith('/api/orders')) {
        // return handleOrders(request, env);
        return new Response(JSON.stringify({ message: 'Orders endpoint not implemented' }), { headers: corsHeaders });
      }
      if (path === '/api/user/profile') {
        // return handleUserProfile(request, env);
        return new Response(JSON.stringify({ user: request.user }), { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('SaaS Platform Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Authenticate request using JWT from Authorization header
 * This is a placeholder implementation.
 */
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Authorization header missing or invalid' };
  }

  const token = authHeader.substring(7);

  try {
    // In a real app, you would use a JWT library to verify the token
    // and decode the user payload.
    // For now, we'll use a mock verification.
    if (token === 'valid-token-for-testing') {
      return {
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          roles: ['customer']
        }
      };
    }
    
    // Example of a simple (and insecure) JWT decode for demonstration
    // const [header, payload, signature] = token.split('.');
    // const decodedPayload = JSON.parse(atob(payload));
    // const isSignatureValid = await verifySignature(header, payload, signature, env.JWT_SECRET);
    // if (!isSignatureValid || decodedPayload.exp < Date.now() / 1000) {
    //   return { success: false, error: 'Invalid or expired token' };
    // }
    // return { success: true, user: decodedPayload };

    return { success: false, error: 'Invalid token' };

  } catch (error) {
    return { success: false, error: 'Token validation failed' };
  }
}
