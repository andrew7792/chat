const CODE = {
    REGISTR: 0,
    LOGIN: 1,
    GET_USERS: 2,
    SET_INFO: 3,
    CHAT: 4
};

const socket = new WebSocket('ws://192.168.1.179:8080');
let hash = null;
let opened = false;

const send = (code, data) => {
    let info = {
        ...data,
        code,
        hash
    };

    socket.send(JSON.stringify(info));
};

socket.addEventListener('open', (event) => {
    opened = true;


    socket.addEventListener('message', (event) => {
        let data = JSON.parse(event.data);
        console.log(data);

        if (data.errors.length) {
            for(let err of data.errors) {
                console.error(err);
            }
        } else {
            switch(data.code) {
                case 0:
                case 1:
                    hash = data.hash;
                    break;

                case 2:
                    console.log(data.users);
                    break;

                case 3:
                    console.log(data.info);
                    break;

                case 4:
                    console.log(data);
                    break;
            }
        }
    });

    /**
     * РЕГИСТРАЦИЯ
     *
     * code: 0,
     * nickname: "Sergio",
     * password: "777"
     */
    send(CODE.REGISTR, {
        nickname: "Sergio",
        password: "777"
    });

    /**
     * АВТОРИЗАЦИЯ
     *
     * code: 1,
     * nickname: "Sergio",
     * password: "777"
     */
    send(CODE.LOGIN, {
        nickname: "Sergio",
        password: "777"
    });

    /**
     * ПОЛУЧЕНИЕ ЮЗЕРОВ
     *
     * code: 2
     */
    send(CODE.GET_USERS, {});

    /**
     * ИЗМЕНЕНИЕ ПАРАМЕТРОВ
     *
     * code: 3,
     * info: {...}
     */
    send(CODE.SET_INFO, {
        info: {
            name: 'Sergey Eduardovich',
            date: '27/06'
        }
    });

    /**
     * СООБЩЕНИЕ
     *
     * code: 4,
     * to: 2,
     * msg: "777"
     */
    send(CODE.CHAT, {to: 2, msg: "Test"});


});