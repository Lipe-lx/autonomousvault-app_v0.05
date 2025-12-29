import { AgentMessage } from '../types';
import { CryptoService } from './cryptoService';
import { StorageService } from './storageService';

export interface Conversation {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
    messages: AgentMessage[];
}

export interface ConversationMetadata {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
}

const STORAGE_PREFIX = 'agent_conversation_';
const METADATA_KEY = 'agent_conversations_metadata';

export class ConversationService {

    /**
     * Gets the user-scoped key for a conversation
     */
    private static getConversationKey(id: string): string {
        return StorageService.getUserKey(`${STORAGE_PREFIX}${id}`);
    }

    /**
     * Gets the user-scoped key for metadata
     */
    private static getMetadataKey(): string {
        return StorageService.getUserKey(METADATA_KEY);
    }

    /**
     * Saves a conversation, encrypting its content.
     * Updates the metadata list automatically.
     */
    static async saveConversation(conversation: Conversation, password: string): Promise<void> {
        if (!process.env.TEST && !password) throw new Error('Password required for encryption');

        try {
            // 1. Encrypt and save full conversation
            const encryptedData = await CryptoService.encrypt(JSON.stringify(conversation), password);
            await StorageService.setItem(this.getConversationKey(conversation.id), encryptedData);

            // 2. Update metadata (unencrypted for sidebar listing)
            const metadata: ConversationMetadata = {
                id: conversation.id,
                title: conversation.title,
                lastMessage: conversation.lastMessage,
                timestamp: conversation.timestamp
            };

            await this.updateMetadata(metadata);
        } catch (error) {
            console.error('Failed to save conversation:', error);
            throw error;
        }
    }

    /**
     * Updates the global metadata list for conversations
     */
    private static async updateMetadata(newMeta: ConversationMetadata): Promise<void> {
        const existingRaw = await StorageService.getItem(this.getMetadataKey());
        let allMetadata: ConversationMetadata[] = existingRaw ? JSON.parse(existingRaw) : [];

        // Remove existing entry if present to update it
        allMetadata = allMetadata.filter(m => m.id !== newMeta.id);

        // Add updated one at the beginning (descending order by default)
        allMetadata.unshift(newMeta);

        // Limit history to 50 conversations to prevent storage bloat
        if (allMetadata.length > 50) {
            const removed = allMetadata.pop();
            if (removed) {
                await StorageService.removeItem(this.getConversationKey(removed.id));
            }
        }

        await StorageService.setItem(this.getMetadataKey(), JSON.stringify(allMetadata));
    }

    /**
     * Loads the list of all conversations (metadata only)
     */
    static async getHistory(): Promise<ConversationMetadata[]> {
        const key = this.getMetadataKey();
        console.log('[ConversationService] Loading history from key:', key);
        const raw = await StorageService.getItem(key);
        console.log('[ConversationService] Raw data:', raw ? `${raw.length} characters` : 'null');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            console.log('[ConversationService] Parsed conversations:', Array.isArray(parsed) ? parsed.length : 'not array');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse conversation history:', e);
            return [];
        }
    }

    /**
     * Loads a specific full conversation, decrypting it
     */
    static async loadConversation(id: string, password: string): Promise<Conversation | null> {
        const encrypted = await StorageService.getItem(this.getConversationKey(id));
        if (!encrypted) return null;

        try {
            const decryptedJson = await CryptoService.decrypt(encrypted, password);
            return JSON.parse(decryptedJson);
        } catch (error) {
            console.error(`Failed to load conversation ${id}:`, error);
            throw new Error('Failed to decrypt conversation. Wrong password?');
        }
    }

    /**
     * Deletes a conversation
     */
    static async deleteConversation(id: string): Promise<void> {
        await StorageService.removeItem(this.getConversationKey(id));

        const existingRaw = await StorageService.getItem(this.getMetadataKey());
        if (existingRaw) {
            let all = JSON.parse(existingRaw) as ConversationMetadata[];
            all = all.filter(c => c.id !== id);
            await StorageService.setItem(this.getMetadataKey(), JSON.stringify(all));
        }
    }

    /**
     * Generates a title usually from the first user message
     */
    static generateTitle(message: string): string {
        if (!message) return 'New Conversation';
        return message.length > 30 ? message.substring(0, 30) + '...' : message;
    }
}
