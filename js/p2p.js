/**
 * WebRTC P2P Matchmaking Manager (powered by PeerJS)
 */
class P2PManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomId = null;
    this.connected = false;
    this.callbacks = {
      onOpen: () => {},
      onConnect: () => {},
      onData: () => {},
      onClose: () => {},
      onError: () => {}
    };
  }

  // 6文字の分かりやすいルームID生成
  generateRoomId() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'janken-' + id;
  }

  // ホストとしてルームを初期化
  createRoom(customId = null, onReady = null) {
    this.isHost = true;
    this.roomId = customId || this.generateRoomId();

    if (this.peer) {
      try { this.peer.destroy(); } catch(e){}
    }

    if (typeof Peer === 'undefined') {
      console.error('PeerJS is not loaded yet');
      this.callbacks.onError('PeerJSライブラリの読み込みに失敗しました。インターネット接続を確認してください。');
      return;
    }

    this.peer = new Peer(this.roomId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      this.roomId = id;
      console.log('Room created with ID:', id);
      if (onReady) onReady(id);
      this.callbacks.onOpen(id);
    });

    this.peer.on('connection', (connection) => {
      console.log('Guest connected:', connection.peer);
      this.conn = connection;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error:', err);
      // IDが重複していたら再生成
      if (err.type === 'unavailable-id') {
        this.createRoom(null, onReady);
      } else {
        this.callbacks.onError(err);
      }
    });
  }

  // ゲストとしてホストに接続
  joinRoom(targetRoomId, onReady = null) {
    this.isHost = false;
    this.roomId = targetRoomId;

    if (this.peer) {
      try { this.peer.destroy(); } catch(e){}
    }

    if (typeof Peer === 'undefined') {
      console.error('PeerJS is not loaded');
      this.callbacks.onError('PeerJSライブラリの読み込みに失敗しました。');
      return;
    }

    this.peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('Guest peer opened:', id, 'Connecting to:', targetRoomId);
      const connection = this.peer.connect(targetRoomId, {
        reliable: true
      });
      this.conn = connection;
      this.setupConnection();
      if (onReady) onReady(targetRoomId);
    });

    this.peer.on('error', (err) => {
      console.warn('Guest peer error:', err);
      this.callbacks.onError(err);
    });
  }

  setupConnection() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      console.log('P2P DataConnection opened successfully!');
      this.connected = true;
      this.callbacks.onConnect({
        isHost: this.isHost,
        peerId: this.conn.peer
      });
    });

    this.conn.on('data', (data) => {
      console.log('Received data:', data);
      this.callbacks.onData(data);
    });

    this.conn.on('close', () => {
      console.log('P2P connection closed');
      this.connected = false;
      this.callbacks.onClose();
    });

    this.conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.callbacks.onError(err);
    });
  }

  send(data) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    } else {
      console.warn('Cannot send data, connection not open');
    }
  }

  destroy() {
    this.connected = false;
    if (this.conn) {
      try { this.conn.close(); } catch(e){}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch(e){}
      this.peer = null;
    }
  }
}

window.p2p = new P2PManager();
