export class Mutex {
    constructor() {
        this._locked = false;
        this._resolvers = [];
    }

    lock() {
        return new Promise(resolve => {
            if (this._locked) {
                this._resolvers.push(resolve);
            } else {
                this._locked = true;
                resolve();
            }
        });
    }

    unlock() {
        const resolve = this._resolvers.shift();
        this._locked = this._resolvers.length > 0;
        resolve?.();
    }
}

