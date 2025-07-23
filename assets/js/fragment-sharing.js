/**
 * Fragment Sharing Manager - Fallback for WebRTC
 * Uses URL fragments to share session state when P2P connections fail
 */

class FragmentSharingManager {
    constructor(onStateUpdate) {
        this.onStateUpdate = onStateUpdate;
        this.currentState = null;
        this.isHost = false;
        this.sessionId = null;
        this.compressionEnabled = true; // Enable state compression
    }

    // Create a new session with fragment sharing
    createSession(sessionId, initialState) {
        this.isHost = true;
        this.sessionId = sessionId;
        this.currentState = {
            sessionId: sessionId,
            version: 1,
            timestamp: Date.now(),
            ...initialState
        };
        
        this.updateURL();
        return this.generateShareableURL();
    }

    // Join session from a fragment URL
    joinSession(url) {
        const state = this.parseFragmentURL(url);
        if (!state) {
            throw new Error('Invalid session URL');
        }
        
        this.isHost = false;
        this.sessionId = state.sessionId;
        this.currentState = state;
        
        // Notify app of the restored state
        this.onStateUpdate(state);
        
        return true;
    }

    // Update session state and generate new URL
    updateState(newState) {
        if (!this.currentState) return null;
        
        this.currentState = {
            ...this.currentState,
            ...newState,
            version: (this.currentState.version || 1) + 1,
            timestamp: Date.now()
        };
        
        this.updateURL();
        return this.generateShareableURL();
    }

    // Generate shareable URL with current state
    generateShareableURL() {
        if (!this.currentState) return null;
        
        const stateData = this.compressState(this.currentState);
        const baseURL = `${window.location.origin}${window.location.pathname}`;
        
        return `${baseURL}#state=${stateData}`;
    }

    // Parse session state from fragment URL
    parseFragmentURL(url) {
        try {
            const hashPart = url.split('#')[1];
            if (!hashPart) return null;
            
            // Handle both 'state=' and 'join=' formats
            let encoded = null;
            if (hashPart.startsWith('state=')) {
                encoded = hashPart.replace('state=', '');
            } else if (hashPart.startsWith('join=')) {
                encoded = hashPart.replace('join=', '');
            } else {
                return null;
            }
            
            return this.decompressState(encoded);
        } catch (error) {
            console.error('Error parsing fragment URL:', error);
            return null;
        }
    }

    // Compress state for URL storage
    compressState(state) {
        try {
            // Create a minimal state object with only essential data
            const minimalState = {
                sid: state.sessionId, // Shortened key names
                v: state.version,
                ts: state.timestamp,
                p: this.compressParticipants(state.participants),
                t: this.compressTasks(state.tasks),
                ct: state.currentTaskId,
                vt: this.compressVotes(state.votes),
                ve: state.votingEnabled,
                vr: state.votesRevealed
            };
            
            // Remove undefined/null values
            Object.keys(minimalState).forEach(key => {
                if (minimalState[key] === undefined || minimalState[key] === null) {
                    delete minimalState[key];
                }
            });
            
            const jsonString = JSON.stringify(minimalState);
            
            // Use base64 encoding with URL-safe characters
            const base64 = btoa(jsonString)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            
            return base64;
        } catch (error) {
            console.error('Error compressing state:', error);
            return null;
        }
    }

    // Decompress state from URL
    decompressState(compressed) {
        try {
            // Restore base64 padding and characters
            let base64 = compressed
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            
            // Add padding
            while (base64.length % 4) {
                base64 += '=';
            }
            
            const jsonString = atob(base64);
            const minimalState = JSON.parse(jsonString);
            
            // Expand back to full state object
            const fullState = {
                sessionId: minimalState.sid,
                version: minimalState.v || 1,
                timestamp: minimalState.ts || Date.now(),
                participants: this.expandParticipants(minimalState.p),
                tasks: this.expandTasks(minimalState.t),
                currentTaskId: minimalState.ct,
                votes: this.expandVotes(minimalState.vt),
                votingEnabled: minimalState.ve || false,
                votesRevealed: minimalState.vr || false
            };
            
            return fullState;
        } catch (error) {
            console.error('Error decompressing state:', error);
            return null;
        }
    }

    // Compress participants map for URL storage
    compressParticipants(participants) {
        if (!participants || typeof participants.entries !== 'function') return [];
        
        return Array.from(participants.entries()).map(([id, participant]) => ({
            i: id,
            n: participant.name,
            h: participant.isHost || false
        }));
    }

    // Expand participants array back to Map
    expandParticipants(compressed) {
        if (!Array.isArray(compressed)) return new Map();
        
        const map = new Map();
        compressed.forEach(p => {
            map.set(p.i, {
                id: p.i,
                name: p.n,
                isHost: p.h || false
            });
        });
        
        return map;
    }

    // Compress tasks array
    compressTasks(tasks) {
        if (!Array.isArray(tasks)) return [];
        
        return tasks.map(task => ({
            i: task.id,
            t: task.title,
            d: task.description || '',
            c: task.createdAt,
            b: task.createdBy
        }));
    }

    // Expand tasks array
    expandTasks(compressed) {
        if (!Array.isArray(compressed)) return [];
        
        return compressed.map(t => ({
            id: t.i,
            title: t.t,
            description: t.d || '',
            createdAt: t.c,
            createdBy: t.b
        }));
    }

    // Compress votes map
    compressVotes(votes) {
        if (!votes || typeof votes.entries !== 'function') return [];
        
        return Array.from(votes.entries()).map(([userId, vote]) => [userId, vote]);
    }

    // Expand votes array back to Map
    expandVotes(compressed) {
        if (!Array.isArray(compressed)) return new Map();
        
        return new Map(compressed);
    }

    // Update browser URL with current state
    updateURL() {
        if (!this.currentState) return;
        
        const stateData = this.compressState(this.currentState);
        if (stateData) {
            const newURL = `#state=${stateData}`;
            
            // Update URL without triggering page reload
            if (window.location.hash !== newURL) {
                window.history.replaceState(null, '', newURL);
            }
        }
    }

    // Check if current URL has session state
    hasSessionInURL() {
        const hash = window.location.hash;
        return hash.includes('state=') || hash.includes('join=');
    }

    // Load session from current URL if available
    loadFromCurrentURL() {
        if (!this.hasSessionInURL()) return null;
        
        const state = this.parseFragmentURL(window.location.href);
        if (state) {
            this.currentState = state;
            this.sessionId = state.sessionId;
            this.onStateUpdate(state);
        }
        
        return state;
    }

    // Get current session state
    getCurrentState() {
        return this.currentState;
    }

    // Calculate URL length for validation
    getURLLength() {
        const url = this.generateShareableURL();
        return url ? url.length : 0;
    }

    // Check if state is too large for URL sharing
    isStateTooLarge() {
        const maxURLLength = 2000; // Conservative limit for URL length
        return this.getURLLength() > maxURLLength;
    }

    // Create a simplified state for sharing when full state is too large
    createSimplifiedState() {
        if (!this.currentState) return null;
        
        const simplified = {
            sessionId: this.currentState.sessionId,
            version: this.currentState.version,
            timestamp: this.currentState.timestamp,
            participants: this.currentState.participants,
            currentTaskId: this.currentState.currentTaskId,
            votingEnabled: this.currentState.votingEnabled,
            votesRevealed: this.currentState.votesRevealed,
            // Include only essential task info
            tasks: this.currentState.tasks.map(task => ({
                id: task.id,
                title: task.title.substring(0, 50), // Truncate long titles
                description: '', // Remove descriptions to save space
                createdAt: task.createdAt,
                createdBy: task.createdBy
            })),
            // Include votes only if revealed
            votes: this.currentState.votesRevealed ? this.currentState.votes : new Map()
        };
        
        return simplified;
    }

    // Reset session state
    reset() {
        this.currentState = null;
        this.isHost = false;
        this.sessionId = null;
        
        // Clear URL hash
        if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }
}

// Export for use in main app
window.FragmentSharingManager = FragmentSharingManager;