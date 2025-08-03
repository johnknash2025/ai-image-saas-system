import { create } from 'zustand';
import { generateImage, getGeneratedImages } from '../services/api';

interface Image {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
}

interface ImageState {
  images: Image[];
  isLoading: boolean;
  error: string | null;
  fetchImages: () => Promise<void>;
  generateNewImage: (prompt: string) => Promise<void>;
}

export const useImageStore = create<ImageState>((set) => ({
  images: [],
  isLoading: false,
  error: null,

  fetchImages: async () => {
    set({ isLoading: true, error: null });
    try {
      const images = await getGeneratedImages();
      set({ images, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  generateNewImage: async (prompt: string) => {
    set({ isLoading: true, error: null });
    try {
      const newImage = await generateImage(prompt);
      set((state) => ({ images: [newImage, ...state.images], isLoading: false }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));
