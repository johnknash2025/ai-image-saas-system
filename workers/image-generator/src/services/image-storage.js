/**
 * Image Storage Service
 * Handles storing and retrieving images from Cloudflare R2
 */
export class ImageStorage {
  constructor(env) {
    this.env = env;
    this.bucket = env.IMAGES;
    this.publicUrl = env.R2_PUBLIC_URL;
  }

  /**
   * Store image in R2 bucket
   */
  async storeImage(imageId, imageData, metadata = {}) {
    try {
      const key = `images/${imageId}.png`;
      
      await this.bucket.put(key, imageData, {
        customMetadata: {
          'content-type': 'image/png',
          'generated-at': new Date().toISOString(),
          ...Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)])
          )
        }
      });

      return key;
    } catch (error) {
      console.error('Failed to store image:', error);
      throw error;
    }
  }

  /**
   * Get image URL (for public access)
   */
  getImageUrl(imageId) {
    if (!this.publicUrl) {
      console.warn('R2_PUBLIC_URL is not configured. Image URLs may not be accessible.');
      return null;
    }
    return `${this.publicUrl}/images/${imageId}.png`;
  }

  /**
   * Get image from R2 bucket
   */
  async getImage(imageId) {
    try {
      const key = `images/${imageId}.png`;
      const object = await this.bucket.get(key);
      
      if (!object) {
        return null;
      }

      return {
        data: await object.arrayBuffer(),
        metadata: object.customMetadata
      };
    } catch (error) {
      console.error('Failed to get image:', error);
      return null;
    }
  }

  /**
   * Delete image from R2 bucket
   */
  async deleteImage(imageId) {
    try {
      const key = `images/${imageId}.png`;
      await this.bucket.delete(key);
      return true;
    } catch (error) {
      console.error('Failed to delete image:', error);
      return false;
    }
  }
}