import {BLOCK_SIZE} from "./Constants.js"
import {iv256} from "./Constants.js"
import {iv512} from "./Constants.js"
import {N_0} from "./Constants.js"
import {PI} from "./Constants.js"
import {TAU} from "./Constants.js"
import {A} from "./Constants.js"
import {C} from "./Constants.js"

export default class Strybog{
    _bit;
    constructor(bit){
        this._bit = bit;
    }

    get bit(){
        return this._bit;
    }


    //Вспомогательные функции
    XOR=(a, b)=>{
        let res = new Uint8Array(BLOCK_SIZE);
        for (let i = 0; i < BLOCK_SIZE; i++) {
            res[i] = a[i] ^ b[i];
        }
        return res;
    }

    addModule = (a, b)=>{
        let res = new Uint8Array(64);
        let tmp = 0;
        let tmpA = new Uint8Array(64);
        let tmpB = new Uint8Array(64);

        for (let i = 0; i < a.length; i++) tmpA[63-i] = a[a.length-i-1];
        for (let i = 0; i < b.length; i++) tmpB[63-i] = b[b.length-i-1];

        for (let i = 63; i >= 0; i--) {
            tmp = tmpA[i] + tmpB[i] + (tmp >> 8);
            res[i] = tmp & 0xff;
        }
        return res;
    }

    //Перестановка байт
    P=(state)=>{
        let res = new Uint8Array(BLOCK_SIZE);
        for (let i = 0; i < BLOCK_SIZE; i++) {
            res[i] = state[TAU[i]];
        }
        return res;
    }

    //Нелинейное биективное преобразование множества двоичных векторов
    S=(state)=>{
        let res = new Uint8Array(BLOCK_SIZE);
        for (let i = 0; i < BLOCK_SIZE; i++) {
            res[i] = PI[state[i]];
        }
        return res;
    }

    //Линейное преобразование множества двоичных векторов
    L=(state)=>{
        let res = new Uint8Array(BLOCK_SIZE);
        for (let i = 0; i < 8; i++) {
            let parts = new Uint32Array(2);
            let tmpArr = new Uint8Array(8);
            tmpArr = state.slice(i*8, i*8 + 8);
            tmpArr.reverse();

            for (let j = 0; j < 8; j++) {
                for (let k = 0; k < 8; k++) {
                    if ((tmpArr[7-j] >> 7-k) & 1) {
                        parts[0] ^= A[j*16 + k*2];
                        parts[1] ^= A[j*16 + k*2 + 1];
                    }
                }
            }

            res[i * 8] = parts[0] >> 24;
            res[i * 8 + 1] = (parts[0] << 8) >> 24;
            res[i * 8 + 2] = (parts[0] << 16) >> 24;
            res[i * 8 + 3] = (parts[0] << 24) >> 24;
            res[i * 8 + 4] = parts[1] >> 24;
            res[i * 8 + 5] = (parts[1] << 8) >> 24;
            res[i * 8 + 6] = (parts[1] << 16) >> 24;
            res[i * 8 + 7] = (parts[1] << 24) >> 24;
        }
        return res;
    }

    //Получение ключей
    KeySchedule=(k, i)=>{
        let res = k;
        res = this.XOR(res, C[i]);
        res = this.S(res);
        res = this.P(res);
        res = this.L(res);
        return res;
    }

    //Преобразование Е
    E=(k, m)=>{
        let state = this.XOR(k, m);
        for (let i = 0; i < 12; i++) {
            state = this.S(state);
            state = this.P(state);
            state = this.L(state);
            k = this.KeySchedule(k, i);
            state = this.XOR(state, k);
        }
        return state;
    }

    //Функция сжатия
    G_N=(n, h, m)=>{
        let k = this.XOR(h, n);
        k = this.S(k);
        k = this.P(k);
        k = this.L(k);
        let tmp = this.E(k, m);
        tmp = this.XOR(tmp, h);
        let newH = this.XOR(tmp, m);
        return newH;
    }

    GetHash(message){
        if((this._bit!=512)&&(this._bit!=265)) return -1
        let paddedMsg = new Uint8Array(BLOCK_SIZE);
        let h = new Uint8Array(BLOCK_SIZE);
        let len = message.length;
        let n = new Uint8Array(BLOCK_SIZE).fill(0);
        let sigma = new Uint8Array(BLOCK_SIZE).fill(0);

        if (this._bit === 512) h = iv512;
        else h = iv256;

        let n512 = new Uint8Array([0, 0, 2, 0]);
        let inc = 0;
        while (len >= BLOCK_SIZE) {
            inc++;
            let tmpMsg = new Uint8Array(BLOCK_SIZE);
            let pos = message.length - inc * BLOCK_SIZE;
            tmpMsg = message.slice(pos, pos + BLOCK_SIZE);
            h = this.G_N(n, h, tmpMsg);
            n = this.addModule(n, n512);
            sigma = this.addModule(sigma, tmpMsg);
            len -= BLOCK_SIZE;
        }

        let msg = new Uint8Array(message.length - inc*64);
        msg = message.slice(0, message.length - inc*64);
        if (msg.length < BLOCK_SIZE) {
          for (let i = 0; i < (BLOCK_SIZE - msg.length - 1); i++) {
            paddedMsg[i] = 0;
          }
          paddedMsg[BLOCK_SIZE - msg.length - 1] = 0x01;
          for (let i = 0; i < msg.length; i++) {
            paddedMsg[BLOCK_SIZE - msg.length + i] = msg[i];
          }
        }
        h = this.G_N(n, h, paddedMsg);
        let msgLen = new Uint8Array(4);
        for (let i = 0; i < 4; i++) {
            msgLen[i] = ([msg.length*8] >> i*8) & 255;
        }
        n = this.addModule(n, msgLen.reverse());
        sigma = this.addModule(sigma, paddedMsg);
        h = this.G_N(N_0, h, n);
        h = this.G_N(N_0, h, sigma);

        if (this._bit == 512) return h;
        else return h.slice(0, 32);
    }

}
