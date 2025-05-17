import Mutex from "../src/mutex";

describe("Mutex", () => {
    it("locks and awaits until unlocked", () => {
        let mtx = new Mutex();
        let flag = false;
        
        let fn1 = async () => {
            await mtx.lock();
            setTimeout(() => {
                expect(flag).toBe(false);
                mtx.unlock();
            }, 150);
        };
        let fn2 = async () => {
            await mtx.lock();
            flag = true;
            mtx.unlock();
        }

        fn1();
        fn2();
        fn2();
    });
});

