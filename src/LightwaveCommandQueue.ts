import { Debugger } from "debug";

export interface QueuedTransaction {
  id: number;
  originalMessage: string;
  message: string;
  resolve: (value: TransactionResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
  retryTimeoutId?: ReturnType<typeof setTimeout>;
  delay: number;
  completed: boolean;
}

export interface TransactionResponse {
  id: number;
  [key: string]: unknown;
}

export interface LightwaveCommandQueueOptions {
  debug: Debugger;
  delay?: number;
  timeout?: number;
  onExecute: (message: string) => void;
}

export class LightwaveCommandQueue {
  private queue: QueuedTransaction[] = [];
  private transactions: Map<number, QueuedTransaction> = new Map();
  private busy = false;
  private debug: Debugger;
  private delay: number;
  private timeout: number;
  private onExecute: (message: string) => void;

  constructor(options: LightwaveCommandQueueOptions) {
    this.debug = options.debug.extend("queue");
    this.delay = options.delay ?? 800;
    this.timeout = options.timeout ?? 10000;
    this.onExecute = options.onExecute;
  }

  send(message: string | Buffer): Promise<TransactionResponse> {
    const transactionId = Math.round(Math.random() * Math.pow(10, 8));
    const messageStr =
      typeof message === "string" ? message : message.toString("utf-8");
    const messageWithTransaction = `${transactionId},${messageStr}`;

    this.debug("[%d] Queueing message: %s", Date.now(), messageWithTransaction);

    const { promise, resolve, reject } =
      Promise.withResolvers<TransactionResponse>();

    const transaction: QueuedTransaction = {
      id: transactionId,
      originalMessage: messageStr,
      message: messageWithTransaction,
      resolve,
      reject,
      delay: this.delay,
      completed: false,
    };

    this.queue.push(transaction);
    this.transactions.set(transactionId, transaction);

    this.processQueue();

    return promise;
  }

  handleResponse(response: TransactionResponse): void {
    const transaction = this.transactions.get(response.id);
    if (!transaction || transaction.completed) {
      this.debug(
        "No pending transaction found for id %d or already completed",
        response.id
      );
      return;
    }

    this.debug("[%d] Transaction %d completed", Date.now(), response.id);
    this.completeTransaction(transaction, response);
  }

  handleRetryableError(transactionId: number): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.completed) {
      return;
    }

    // Clear existing timeout
    if (transaction.timeoutId) {
      clearTimeout(transaction.timeoutId);
      transaction.timeoutId = undefined;
    }

    // Exponential backoff, max 10 seconds
    transaction.delay = Math.min(transaction.delay * 2, 10000);

    const retryMessage = `${transactionId},${transaction.originalMessage}`;
    this.debug(
      "Message errored, retrying: %s with delay: %d",
      retryMessage,
      transaction.delay
    );

    // Set timeout for retry
    transaction.timeoutId = setTimeout(() => {
      if (transaction.completed) return;
      this.debug("Retry timeout expired for transaction %d", transactionId);
      this.failTransaction(
        transaction,
        new Error(`Retry timeout expired ${transactionId}`)
      );
    }, 5000 + transaction.delay * 2);

    // Schedule retry
    transaction.retryTimeoutId = setTimeout(() => {
      if (transaction.completed) return;
      this.onExecute(retryMessage);
    }, Math.round(transaction.delay * 2));
  }

  destroy(): void {
    for (const transaction of this.transactions.values()) {
      if (transaction.timeoutId) {
        clearTimeout(transaction.timeoutId);
      }
      if (transaction.retryTimeoutId) {
        clearTimeout(transaction.retryTimeoutId);
      }
      if (!transaction.completed) {
        transaction.reject(new Error("Queue destroyed"));
        transaction.completed = true;
      }
    }
    this.transactions.clear();
    this.queue = [];
    this.busy = false;
  }

  private processQueue(): void {
    if (this.busy) {
      this.debug("Queue is busy, waiting to process");
      return;
    }

    const transaction = this.queue.shift();
    if (!transaction) {
      return;
    }

    this.debug("Processing transaction: %d", transaction.id);
    this.busy = true;

    // Set timeout for response
    transaction.timeoutId = setTimeout(() => {
      if (transaction.completed) return;
      this.debug("Transaction %d timed out", transaction.id);
      this.failTransaction(
        transaction,
        new Error(`Execution expired ${transaction.id}`)
      );
    }, this.timeout);

    this.onExecute(transaction.message);
  }

  private completeTransaction(
    transaction: QueuedTransaction,
    response: TransactionResponse
  ): void {
    if (transaction.completed) return;

    transaction.completed = true;

    if (transaction.timeoutId) {
      clearTimeout(transaction.timeoutId);
    }
    if (transaction.retryTimeoutId) {
      clearTimeout(transaction.retryTimeoutId);
    }

    this.transactions.delete(transaction.id);
    transaction.resolve(response);

    this.debug(
      "Transaction %d completed, scheduling next in %dms",
      transaction.id,
      this.delay
    );

    setTimeout(() => {
      this.busy = false;
      this.processQueue();
    }, this.delay);
  }

  private failTransaction(
    transaction: QueuedTransaction,
    error: Error
  ): void {
    if (transaction.completed) return;

    transaction.completed = true;

    if (transaction.timeoutId) {
      clearTimeout(transaction.timeoutId);
    }
    if (transaction.retryTimeoutId) {
      clearTimeout(transaction.retryTimeoutId);
    }

    this.transactions.delete(transaction.id);
    transaction.reject(error);

    this.busy = false;
    this.processQueue();
  }
}
