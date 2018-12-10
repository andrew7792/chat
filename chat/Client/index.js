
class ChatContent {
    constructor() {
        this.userNode = document.querySelector('.chat-users');
        this.contentNode = document.querySelector('.chat-main-content');

        this.users = [];
        this.activeUser = -1;

        this.msg = [];

        this.render();
    }

    setMsg(msg) {
        this.msg = msg;
        this.renderMsg();
    }

    renderMsg() {
        while(this.contentNode.firstChild) {
            this.contentNode.removeChild(this.contentNode.firstChild);
        }
        for(let msg of this.msg) {
            let template = `<div class="chat-msg-row #self"><div class="chat-msg"><pre>#content</pre></div></div>`;
            if (msg.self) {
                template = template.replace('#self', 'self');
            } else {
                template = template.replace('#self', '');
            }

            template = template.replace('#content', msg.content);
            this.contentNode.innerHTML += template;
        }
    }

    render() {
        while(this.userNode.firstChild) {
            this.userNode.removeChild(this.userNode.firstChild);
        }

        for(let user of this.users) {
            let div = document.createElement('div');
            div.className = 'chat-user';
            div.innerText = user.name;

            if (user.id === this.activeUser) {
                div.classList.add('active');
            }

            div.addEventListener('click', () => {
                this.activeUser = user.id;
                if (user.onSelect) user.onSelect();
                this.render();
            });

            this.userNode.appendChild(div);
        }

        this.renderMsg();
    }

    addUser(name, id, onSelect) {
        for(let user of this.users) {
            if (user.id === id) {
                user.name = name;
                this.render();
                return false;
            }
        }
        this.users.push(new User(name, id, onSelect));
        this.render();
    }
}

class User {
    constructor(name, id, onSelect = null) {
        this.name = name;
        this.id = id;
        this.onSelect = onSelect;
    }
}

const content = new ChatContent();

const CODE = {
    REGISTR: 0,
    LOGIN: 1,
    GET_USERS: 2,
    SET_INFO: 3,
    CHAT: 4
};

class Chat {
    constructor(chatcontent) {
        this.content = chatcontent;

        this.opened = false;

        this.hash = null;
        this.id = -1;

        this.targetUser = -1;

        this.messages = {};

        this.ws = new WebSocket('ws://192.168.1.179:8080');
        this.ws.addEventListener('open', () => {
            this.init();
        });
    }

    send(code, data) {
        let info = {
            ...data,
            code,
            hash: this.hash
        };

        this.ws.send(JSON.stringify(info));
    }

    registr(nick, pass) {
        this.send(CODE.REGISTR, {
            nickname: nick,
            password: pass
        });
    }

    login(nick, pass) {
        this.send(CODE.LOGIN, {
            nickname: nick,
            password: pass
        });
    }

    msg(to, msg) {
        this.send(CODE.CHAT, {
            to,
            msg
        });
    }

    init() {
        this.opened = true;

        document.querySelector('#textfield')
            .addEventListener('keydown', (e) => {
                if (e.keyCode === 13 &&
                    e.shiftKey === false &&
                    this.targetUser > 0) {

                    let msg = e.currentTarget.value;
                    this.msg(this.targetUser, msg);
                    e.currentTarget.value = null;
                    e.preventDefault();
                }
            });

        this.ws.addEventListener('message', (event) => {
            let data = JSON.parse(event.data);
            if (data.errors.length) {
                console.error(data.errors);
                return false;
            }

            console.log(data);

            switch(data.code) {
                case CODE.REGISTR:
                case CODE.LOGIN:
                    this.hash = data.hash;
                    this.id = data.id;
                    break;
                case CODE.GET_USERS:
                        for(let user of data.users) {
                            if (user.id !== this.id) {
                                if (!this.messages[user.id]) {
                                    this.messages[user.id] = [];
                                }
                                this.content.addUser(user.nickname, user.id, () => {
                                    this.content.setMsg(this.messages[user.id]);
                                    this.targetUser = user.id;
                                });
                            }
                        }
                    break;
                case CODE.CHAT:
                    console.log(data);
                    let target;
                    if (data.from === this.id) {
                        target = data.to;
                    } else {
                        target = data.from;
                    }
                    if (!this.messages[target]) {
                        this.messages[target] = [];
                    }

                    this.messages[target].push({
                        content: data.msg,
                        self: data.from === this.id
                    });

                    if (this.targetUser === target)
                    this.content.setMsg(this.messages[target]);

                    break;
            }
        });
    }


}

const chat = new Chat(content);