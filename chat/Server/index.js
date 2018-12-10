const WebSocket = require('ws');
const crypto = require('crypto');

const salt = crypto.randomBytes(128).toString('base64');

const wss = new WebSocket.Server({
    port: 8080,
    perMessageDeflate: {
        zlibDeflateOptions: {
            // See zlib defaults.
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
    }
});

const hashPwd = function hashPwd(pwd) {
    let hmac = crypto.createHmac('sha256', salt);
    return hmac.update(pwd).digest('hex');
};

class Client {
    constructor(nickname, pass, id = -1) {
        this.nickname = nickname;
        this.pass = pass;
        this.info = {};
        this.id = id;
        this.hash = hashPwd(nickname + pass + id);
        this.socket = null;
    }

    equals(nick, pass = null) {
        return (this.nickname === nick) && (this.pass === pass || pass === null);
    }

    setInfo(info = {}) {
        this.info = info;
    }

    getInfo() {
        return {
            nickname: this.nickname,
            id: this.id,
            info: this.info,
            hash: this.hash
        }
    }
}

class Room {
    constructor(list) {
        this.clients = [];
        this.list = list;
    }

    hasDialog(id1, id2) {
        return (this.clients.length === 2) && (this.clients.indexOf(id1) && this.clients.indexOf(id2))
    }


}

class ClientList {
    constructor() {
        this.clients = [];
        this.rooms = [];
        this.counter = 0;
    }

    has(nick, pass = null) {
        for(let client of this.clients) {
            if (client.equals(nick, pass)) {
                return true;
            }
        }

        return false;
    }

    find(nick, pass = null) {
        for(let client of this.clients) {
            if (client.equals(nick, pass)) {
                return client;
            }
        }

        return null;
    }

    findByHash(hash) {
        for(let client of this.clients) {
            if (client.hash === hash) {
                return client;
            }
        }

        return null;
    }

    findById(id) {
        for(let client of this.clients) {
            if (client.id === id) {
                return client;
            }
        }

        return null;
    }

    getInfo(hash) {
        let client = this.findByHash(hash);
        if (!client) {
            return null;
        }

        return {
            id: client.id,
            nickname: client.nickname,
            info: client.info
        };
    }

    register(nick, pass) {
        if (!this.has(nick)) {
            let client = new Client(nick, pass, ++this.counter);
            this.clients.push(client);
            return client;
        }

        return null;
    }

    login(nick, pass) {
        let client = this.find(nick, pass);

        if (!client) {
            return false;
        }

        return true;
    }

    isLoginned(hash) {
        return !!this.findByHash(hash);
    }

    setInfo(hash, info) {
        let client = this.findByHash(hash);
        if (hash) {
            client.info = info;
        }
    }

    getUsers() {
        let data = [];
        for(let user of this.clients) {
            data.push({
                nickname: user.nickname,
                id: user.id,
                info: user.info
            });
        }
        return data;
    }
}

const List = new ClientList();

//let client = List.register("Serg", "Test");
//console.log(client.hash);

const DATA = (code, data, errors = []) => {
    return JSON.stringify({...data, errors, code});
};

const broadCast = (data) => {
    for(let client of List.clients) {
        client.socket.send(data);
    }
};

wss.on('connection', function connection(ws) {

    //console.log('connected');

    ws.on('open', function open() {
        console.log('connected');
    });

    ws.on('close', function close() {
        console.log('disconnected');
    });

    ws.on('message', function incoming(message) {
        let data = JSON.parse(message);
        let client, nick, pass, hash, info;
        switch (data.code) {
            case 0:
                nick = data.nickname;
                pass = data.password;
                client = List.register(nick, pass);
                if (client) {
                    client.socket = ws;
                    ws.send(DATA(0, client.getInfo()));
                    broadCast(DATA(2, {users: List.getUsers()}));
                } else {
                    ws.send(DATA(0, {}, ['Nickname already exist']));
                }
                break;
            case 1:
                nick = data.nickname;
                pass = data.password;
                client = List.login(nick, pass);
                if (client) {
                    List.find(nick, pass).socket = ws;
                    ws.send(DATA(1, List.find(nick, pass).getInfo()));
                    broadCast(DATA(2, {users: List.getUsers()}));
                } else {
                    ws.send(DATA(1, {}, ['This user is not logged']));
                }
                break;
            case 2:
                hash = data.hash;
                client = List.findByHash(hash);
                if (client) {
                    ws.send(DATA(2, {users: List.getUsers()}));
                } else {
                    ws.send(DATA(2, {}, ['This user is not logged']));
                }
                break;
            case 3:
                hash = data.hash;
                info = data.info;
                client = List.findByHash(hash);
                if (client) {
                    client.setInfo(info);
                    ws.send(DATA(3, client.getInfo()));
                }
                break;
            case 4:
                hash = data.hash;
                let to = data.to;
                let msg = data.msg;
                client = List.findByHash(hash);
                let client2 = List.findById(+to);
                if (client && client2) {
                    if (client.socket.readyState === 1) client.socket.send(DATA(4, {from: client.id, to, msg}));
                    if (client2.socket.readyState === 1) client2.socket.send(DATA(4, {from: client.id, to, msg}));
                }
                break;
        }
        console.log('received: %s', message);
    });
});

console.log('Server started');