/**
 * WebRTC Manager for P2P Planning Poker Sessions
 * Handles peer-to-peer connections and message broadcasting
 */

class WebRTCManager {
    constructor(onMessage, onConnectionChange) {
        this.onMessage = onMessage;
        this.onConnectionChange = onConnectionChange;
        
        this.isHost = false;
        this.sessionId = null;
        this.peers = new Map(); // peerId -> RTCPeerConnection
        this.dataChannels = new Map(); // peerId -> RTCDataChannel
        this.connectionStates = new Map(); // peerId -> connection state
        
        // WebRTC configuration with public STUN servers
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.isWebRTCSupported = this.checkWebRTCSupport();
    }

    checkWebRTCSupport() {
        return !!(window.RTCPeerConnection && window.RTCDataChannel);
    }

    generatePeerId() {
        return 'peer-' + Math.random().toString(36).substring(2, 11);
    }

    // Host creates a session and becomes the central relay
    async createHostSession(sessionId) {
        if (!this.isWebRTCSupported) {
            throw new Error('WebRTC not supported in this browser');
        }

        this.isHost = true;
        this.sessionId = sessionId;
        this.myPeerId = 'host';
        
        console.log('Created host session:', sessionId);
        this.onConnectionChange('host', 'ready');
        
        // Host is ready to accept connections
        return this.generateSessionURL();
    }

    // Participant joins by connecting to host
    async joinSession(sessionURL) {
        if (!this.isWebRTCSupported) {
            throw new Error('WebRTC not supported in this browser');
        }

        const urlData = this.parseSessionURL(sessionURL);
        if (!urlData) {
            throw new Error('Invalid session URL');
        }

        this.isHost = false;
        this.sessionId = urlData.sessionId;
        this.myPeerId = this.generatePeerId();
        
        // For now, we'll use a simplified connection process
        // In a real P2P system, we'd need a signaling server
        // Here we'll simulate the connection
        console.log('Joining session:', this.sessionId);
        this.onConnectionChange(this.myPeerId, 'connecting');
        
        // Simulate successful connection after a delay
        setTimeout(() => {
            this.onConnectionChange(this.myPeerId, 'connected');
        }, 1000);
        
        return true;
    }

    // Create a peer connection for a new participant
    async createPeerConnection(peerId) {
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        this.peers.set(peerId, peerConnection);
        
        // Create data channel for messaging
        const dataChannel = peerConnection.createDataChannel('messages', {
            ordered: true
        });
        
        this.setupDataChannel(dataChannel, peerId);
        this.dataChannels.set(peerId, dataChannel);
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // In a real implementation, send this to the peer via signaling
                console.log('ICE candidate for', peerId, event.candidate);
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            this.connectionStates.set(peerId, state);
            this.onConnectionChange(peerId, state);
            
            if (state === 'disconnected' || state === 'failed') {
                this.handlePeerDisconnection(peerId);
            }
        };
        
        return peerConnection;
    }

    setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => {
            console.log('Data channel opened for peer:', peerId);
            this.onConnectionChange(peerId, 'connected');
        };
        
        dataChannel.onclose = () => {
            console.log('Data channel closed for peer:', peerId);
            this.onConnectionChange(peerId, 'disconnected');
        };
        
        dataChannel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                message.fromPeer = peerId;
                this.onMessage(message);
            } catch (error) {
                console.error('Error parsing message from peer:', peerId, error);
            }
        };
        
        dataChannel.onerror = (error) => {
            console.error('Data channel error for peer:', peerId, error);
        };
    }

    // Send message to all connected peers
    broadcastMessage(message) {
        const messageStr = JSON.stringify({
            ...message,
            timestamp: Date.now(),
            fromPeer: this.myPeerId
        });
        
        if (this.isHost) {
            // Host broadcasts to all connected peers
            for (let [peerId, dataChannel] of this.dataChannels) {
                if (dataChannel.readyState === 'open') {
                    try {
                        dataChannel.send(messageStr);
                    } catch (error) {
                        console.error('Error sending to peer:', peerId, error);
                    }
                }
            }
        } else {
            // Participants send to host only
            const hostChannel = this.dataChannels.get('host');
            if (hostChannel && hostChannel.readyState === 'open') {
                try {
                    hostChannel.send(messageStr);
                } catch (error) {
                    console.error('Error sending to host:', error);
                }
            }
        }
        
        // Also handle the message locally
        this.onMessage({...message, fromPeer: this.myPeerId});
    }

    // Send message to specific peer
    sendToPeer(peerId, message) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                const messageStr = JSON.stringify({
                    ...message,
                    timestamp: Date.now(),
                    fromPeer: this.myPeerId
                });
                dataChannel.send(messageStr);
            } catch (error) {
                console.error('Error sending to peer:', peerId, error);
            }
        }
    }

    handlePeerDisconnection(peerId) {
        console.log('Peer disconnected:', peerId);
        
        // Clean up peer connection
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peers.delete(peerId);
        }
        
        // Clean up data channel
        this.dataChannels.delete(peerId);
        this.connectionStates.delete(peerId);
        
        // Notify about disconnection
        this.onMessage({
            type: 'user-disconnected',
            peerId: peerId,
            fromPeer: 'system'
        });
    }

    // Generate shareable session URL
    generateSessionURL() {
        const sessionData = {
            sessionId: this.sessionId,
            type: 'webrtc',
            timestamp: Date.now()
        };
        
        const encoded = btoa(JSON.stringify(sessionData));
        return `${window.location.origin}${window.location.pathname}#join=${encoded}`;
    }

    // Parse session URL to extract connection info
    parseSessionURL(url) {
        try {
            const hashPart = url.split('#')[1];
            if (!hashPart || !hashPart.startsWith('join=')) {
                return null;
            }
            
            const encoded = hashPart.replace('join=', '');
            const decoded = JSON.parse(atob(encoded));
            
            return decoded;
        } catch (error) {
            console.error('Error parsing session URL:', error);
            return null;
        }
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isWebRTCSupported: this.isWebRTCSupported,
            isHost: this.isHost,
            sessionId: this.sessionId,
            myPeerId: this.myPeerId,
            connectedPeers: Array.from(this.dataChannels.keys()).filter(
                peerId => this.dataChannels.get(peerId)?.readyState === 'open'
            ),
            connectionStates: Object.fromEntries(this.connectionStates)
        };
    }

    // Disconnect from session
    disconnect() {
        console.log('Disconnecting from session');
        
        // Close all peer connections
        for (let [peerId, peerConnection] of this.peers) {
            peerConnection.close();
        }
        
        // Close all data channels
        for (let [peerId, dataChannel] of this.dataChannels) {
            if (dataChannel.readyState !== 'closed') {
                dataChannel.close();
            }
        }
        
        // Clear all maps
        this.peers.clear();
        this.dataChannels.clear();
        this.connectionStates.clear();
        
        // Reset state
        this.isHost = false;
        this.sessionId = null;
        this.myPeerId = null;
        
        this.onConnectionChange('self', 'disconnected');
    }

    // Simulate peer connections for demo purposes
    // In a real implementation, this would use proper WebRTC signaling
    simulateConnection(peerId) {
        console.log('Simulating connection to peer:', peerId);
        
        // Create a mock data channel that uses localStorage for messaging
        const mockChannel = {
            readyState: 'open',
            send: (data) => {
                // Store message in localStorage with a key that other tabs can listen to
                const key = `webrtc-message-${this.sessionId}-${Date.now()}-${Math.random()}`;
                localStorage.setItem(key, data);
                
                // Clean up the message after a short delay
                setTimeout(() => {
                    localStorage.removeItem(key);
                }, 5000);
            }
        };
        
        this.dataChannels.set(peerId, mockChannel);
        this.connectionStates.set(peerId, 'connected');
        this.onConnectionChange(peerId, 'connected');
        
        // Listen for messages from other tabs/windows
        this.startLocalStorageMessaging();
    }

    startLocalStorageMessaging() {
        if (this.storageListener) return; // Already listening
        
        this.storageListener = (event) => {
            if (event.key && event.key.startsWith(`webrtc-message-${this.sessionId}-`) && event.newValue) {
                try {
                    const message = JSON.parse(event.newValue);
                    // Only process messages not from ourselves
                    if (message.fromPeer !== this.myPeerId) {
                        this.onMessage(message);
                    }
                } catch (error) {
                    console.error('Error parsing localStorage message:', error);
                }
            }
        };
        
        window.addEventListener('storage', this.storageListener);
    }

    stopLocalStorageMessaging() {
        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
            this.storageListener = null;
        }
    }
}

// Export for use in main app
window.WebRTCManager = WebRTCManager;