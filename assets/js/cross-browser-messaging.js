/**
 * Cross-Browser Messaging Manager
 * Handles real communication between different browsers using multiple fallback methods
 */

class CrossBrowserMessaging {
    constructor(sessionId, onMessage, onConnectionChange) {
        this.sessionId = sessionId;
        this.onMessage = onMessage;
        this.onConnectionChange = onConnectionChange;
        
        this.myUserId = null;
        this.isHost = false;
        this.broadcastChannel = null;
        this.storageListener = null;
        this.heartbeatInterval = null;
        this.participants = new Map();
        this.lastHeartbeat = Date.now();
        
        this.supportsBroadcastChannel = 'BroadcastChannel' in window;
        this.supportsServiceWorker = 'serviceWorker' in navigator;
        
        console.log('CrossBrowserMessaging initialized:', {
            sessionId: this.sessionId,
            supportsBroadcastChannel: this.supportsBroadcastChannel,
            supportsServiceWorker: this.supportsServiceWorker
        });
    }

    // Initialize connection as host
    initializeAsHost(userId) {
        this.myUserId = userId;
        this.isHost = true;
        
        console.log('Initializing as host:', userId);
        
        this.setupBroadcastChannel();
        this.setupLocalStorageMessaging();
        this.startHeartbeat();
        
        // Add host to participants
        this.participants.set(userId, {
            id: userId,
            lastSeen: Date.now(),
            isHost: true
        });
        
        this.onConnectionChange('host', 'ready');
        return true;
    }

    // Initialize connection as participant
    initializeAsParticipant(userId) {
        this.myUserId = userId;
        this.isHost = false;
        
        console.log('Initializing as participant:', userId);
        
        this.setupBroadcastChannel();
        this.setupLocalStorageMessaging();
        this.startHeartbeat();
        
        // Announce joining
        this.broadcastMessage({
            type: 'user-joined',
            userId: userId,
            timestamp: Date.now()
        });
        
        this.onConnectionChange('participant', 'connected');
        return true;
    }

    // Setup BroadcastChannel for same-origin communication
    setupBroadcastChannel() {
        if (!this.supportsBroadcastChannel) {
            console.log('BroadcastChannel not supported, using localStorage only');
            return;
        }

        try {
            const channelName = `planning-poker-${this.sessionId}`;
            this.broadcastChannel = new BroadcastChannel(channelName);
            
            this.broadcastChannel.onmessage = (event) => {
                this.handleMessage(event.data, 'broadcast');
            };
            
            this.broadcastChannel.onerror = (error) => {
                console.error('BroadcastChannel error:', error);
            };
            
            console.log('BroadcastChannel setup complete:', channelName);
        } catch (error) {
            console.error('Failed to setup BroadcastChannel:', error);
            this.broadcastChannel = null;
        }
    }

    // Setup localStorage messaging for cross-browser communication
    setupLocalStorageMessaging() {
        const storageKey = `planning-poker-messages-${this.sessionId}`;
        
        this.storageListener = (event) => {
            if (event.key === storageKey && event.newValue) {
                try {
                    const message = JSON.parse(event.newValue);
                    // Don't process our own messages
                    if (message.senderId !== this.myUserId) {
                        this.handleMessage(message, 'localStorage');
                    }
                } catch (error) {
                    console.error('Error parsing localStorage message:', error);
                }
            }
        };
        
        window.addEventListener('storage', this.storageListener);
        console.log('localStorage messaging setup complete');
    }

    // Start heartbeat to track active participants  
    startHeartbeat() {
        // Send heartbeat every 3 seconds
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
            this.checkParticipantHealth();
        }, 3000);
        
        // Send initial heartbeat
        this.sendHeartbeat();
    }

    sendHeartbeat() {
        this.broadcastMessage({
            type: 'heartbeat',
            userId: this.myUserId,
            isHost: this.isHost,
            timestamp: Date.now()
        });
    }

    checkParticipantHealth() {
        const now = Date.now();
        const timeout = 10000; // 10 seconds timeout
        
        for (let [userId, participant] of this.participants) {
            if (userId !== this.myUserId && (now - participant.lastSeen) > timeout) {
                console.log('Participant timed out:', userId);
                this.participants.delete(userId);
                
                this.onMessage({
                    type: 'user-left',
                    userId: userId,
                    reason: 'timeout',
                    fromSystem: true
                });
            }
        }
    }

    // Handle incoming messages from any source
    handleMessage(message, source) {
        if (!message || !message.type) return;
        
        // Update participant last seen time
        if (message.userId && message.userId !== this.myUserId) {
            this.participants.set(message.userId, {
                id: message.userId,
                lastSeen: Date.now(),
                isHost: message.isHost || false
            });
        }
        
        // Handle different message types
        switch (message.type) {
            case 'heartbeat':
                // Just update participant info, already handled above
                break;
                
            case 'user-joined':
                console.log('User joined via', source, ':', message.userId);
                
                // If we're the host, send full state to new user
                if (this.isHost && message.userId !== this.myUserId) {
                    setTimeout(() => {
                        this.sendStateSync(message.userId);
                    }, 500); // Small delay to ensure they're ready
                }
                break;
                
            case 'request-state':
                // Send state sync if we're the host
                if (this.isHost) {
                    this.sendStateSync(message.userId);
                }
                break;
                
            default:
                // Forward message to app
                this.onMessage({
                    ...message,
                    fromPeer: message.userId,
                    source: source
                });
                break;
        }
    }

    // Broadcast message using all available methods
    broadcastMessage(message) {
        const messageWithId = {
            ...message,
            senderId: this.myUserId,
            sessionId: this.sessionId,
            timestamp: Date.now()
        };
        
        // Send via BroadcastChannel (same-origin)
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage(messageWithId);
            } catch (error) {
                console.error('BroadcastChannel send error:', error);
            }
        }
        
        // Send via localStorage (cross-browser)
        try {
            const storageKey = `planning-poker-messages-${this.sessionId}`;
            const storageValue = JSON.stringify(messageWithId);
            
            localStorage.setItem(storageKey, storageValue);
            
            // Clean up old messages after a delay
            setTimeout(() => {
                try {
                    if (localStorage.getItem(storageKey) === storageValue) {
                        localStorage.removeItem(storageKey);
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            }, 5000);
        } catch (error) {
            console.error('localStorage send error:', error);
        }
        
        console.log('Broadcasted message:', message.type, messageWithId);
    }

    // Send state sync to specific user or all users
    sendStateSync(targetUserId = null) {
        if (!this.isHost) return;
        
        // This will be called by the main app to send current state
        this.onMessage({
            type: 'request-state-sync',
            targetUserId: targetUserId,
            fromSystem: true
        });
    }

    // Request current state from host (for new participants)
    requestState() {
        if (this.isHost) return;
        
        this.broadcastMessage({
            type: 'request-state',
            userId: this.myUserId
        });
    }

    // Get list of active participants
    getActiveParticipants() {
        const now = Date.now();
        const activeParticipants = [];
        
        for (let [userId, participant] of this.participants) {
            if ((now - participant.lastSeen) < 15000) { // 15 second window
                activeParticipants.push({
                    id: userId,
                    isHost: participant.isHost,
                    lastSeen: participant.lastSeen
                });
            }
        }
        
        return activeParticipants;
    }

    // Disconnect and cleanup
    disconnect() {
        console.log('Disconnecting cross-browser messaging');
        
        // Send leaving message
        this.broadcastMessage({
            type: 'user-left',
            userId: this.myUserId,
            reason: 'disconnect'
        });
        
        // Cleanup intervals
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // Cleanup listeners
        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
            this.storageListener = null;
        }
        
        // Cleanup broadcast channel
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
        
        // Clear participants
        this.participants.clear();
        
        this.onConnectionChange('self', 'disconnected');
    }

    // Get connection status
    getConnectionStatus() {
        return {
            sessionId: this.sessionId,
            myUserId: this.myUserId,
            isHost: this.isHost,
            supportsBroadcastChannel: this.supportsBroadcastChannel,
            activeParticipants: this.getActiveParticipants().length,
            connectionMethods: {
                broadcastChannel: !!this.broadcastChannel,
                localStorage: !!this.storageListener
            }
        };
    }
}

// Export for use in main app
window.CrossBrowserMessaging = CrossBrowserMessaging;