const jwt = require('jsonwebtoken');
const EventEmitter = require('events');

class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
    this.rooms = new Map();
  }

  addClient(clientId, ws) {
    this.clients.set(clientId, {
      ws,
      subscriptions: new Set(),
      metadata: {}
    });
  }

  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Clean up subscriptions
      client.subscriptions.forEach(room => {
        this.leaveRoom(clientId, room);
      });
      this.clients.delete(clientId);
    }
  }

  joinRoom(clientId, room) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(clientId);
    
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(room);
    }
  }

  leaveRoom(clientId, room) {
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  broadcast(room, message) {
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === 1) {
          client.ws.send(JSON.stringify(message));
        }
      });
    }
  }
}

const wsManager = new WebSocketManager();

function initializeWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    console.log(`New WebSocket connection: ${clientId}`);
    
    // Add client to manager
    wsManager.addClient(clientId, ws);
    
    // Set up event listeners
    ws.on('message', (data) => {
      handleMessage(clientId, data);
    });
    
    // Memory leak: Event listeners not properly cleaned up
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${clientId}:`, error);
    });
    
    ws.on('pong', () => {
      const client = wsManager.clients.get(clientId);
      if (client) {
        client.metadata.lastPong = Date.now();
      }
    });
    
    // Handle disconnection - missing proper cleanup
    ws.on('close', () => {
      console.log(`WebSocket closed: ${clientId}`);
      wsManager.removeClient(clientId);
      // Note: Event listeners attached to ws are not removed
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    }));
  });
  
  // Heartbeat to detect broken connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
}

function handleMessage(clientId, data) {
  try {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'subscribe':
        handleSubscribe(clientId, message);
        break;
      case 'unsubscribe':
        handleUnsubscribe(clientId, message);
        break;
      case 'broadcast':
        handleBroadcast(clientId, message);
        break;
      case 'authenticate':
        handleAuthenticate(clientId, message);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error);
  }
}

function handleSubscribe(clientId, message) {
  const { room } = message;
  if (room) {
    wsManager.joinRoom(clientId, room);
    console.log(`Client ${clientId} subscribed to ${room}`);
    
    // Notify client of successful subscription
    const client = wsManager.clients.get(clientId);
    if (client) {
      client.ws.send(JSON.stringify({
        type: 'subscribed',
        room,
        timestamp: new Date().toISOString()
      }));
    }
  }
}

function handleUnsubscribe(clientId, message) {
  const { room } = message;
  if (room) {
    wsManager.leaveRoom(clientId, room);
    console.log(`Client ${clientId} unsubscribed from ${room}`);
  }
}

function handleBroadcast(clientId, message) {
  const { room, payload } = message;
  if (room && payload) {
    wsManager.broadcast(room, {
      type: 'message',
      room,
      payload,
      sender: clientId,
      timestamp: new Date().toISOString()
    });
  }
}

function handleAuthenticate(clientId, message) {
  const { token } = message;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const client = wsManager.clients.get(clientId);
    
    if (client) {
      client.metadata.authenticated = true;
      client.metadata.userId = decoded.userId;
      
      client.ws.send(JSON.stringify({
        type: 'authenticated',
        userId: decoded.userId,
        timestamp: new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    const client = wsManager.clients.get(clientId);
    if (client) {
      client.ws.send(JSON.stringify({
        type: 'auth_error',
        message: 'Invalid token'
      }));
    }
  }
}

function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Broadcast to all clients in a room
function broadcastToRoom(room, message) {
  wsManager.broadcast(room, message);
}

// Get connected clients count
function getConnectedClientsCount() {
  return wsManager.clients.size;
}

module.exports = {
  initializeWebSocket,
  broadcastToRoom,
  getConnectedClientsCount,
  wsManager
};