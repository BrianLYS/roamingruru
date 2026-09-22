import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { elevenLabsVoice } from './server/voice.ts';
import { visitorMemory } from './server/memory.ts';
import { outfitDiscovery } from './server/outfit.ts';
import { luluConversation } from './server/conversation.ts';
export default defineConfig({ plugins: [react(), elevenLabsVoice(), visitorMemory(), outfitDiscovery(), luluConversation()] });
