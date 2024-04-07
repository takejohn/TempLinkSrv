/**
 * 非同期タスクを追加された順に実行するジョブキュー。
 */
export class JobQueue {
    private readonly tasks: (() => Promise<unknown>)[] = [];

    private readonly handler: ((e: unknown) => void) | null;

    private isRunning = false;

    /**
     * ジョブキューを作成する。
     * @param handler Promise が reject されたときに行う処理
     */
    public constructor(handler: ((e: unknown) => void) | null = null) {
        this.handler = handler;
    }

    /**
     * ジョブキューに残っているタスクの個数。
     */
    public get length() {
        return this.tasks.length;
    }

    /**
     * このジョブキューに非同期タスクを追加する。
     * @param task タスク
     * @returns 与えられたタスクを実行する Promise
     */
    public run<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.tasks.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
            this.onAdd();
        });
    }

    private async onAdd() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        try {
            const tasks = this.tasks;
            let task = tasks.shift();
            while (task != null) {
                await task();
                task = tasks.shift();
            }
        } catch (e) {
            this.handler?.(e);
        } finally {
            this.isRunning = false;
        }
    }
}
