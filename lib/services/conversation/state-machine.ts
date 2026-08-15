/**
 * Conversation State Machine
 * 
 * Implements the finite-state machine for conversation flow
 * Handles state transitions, operation tracking, and error recovery
 */

import { createLocalId } from '@/lib/utils';
import {
  ConversationState,
  ConversationStore,
  ConversationOperation,
  ConversationError,
  ConversationErrorCode,
  isValidTransition,
  VALID_TRANSITIONS,
} from './types';

export interface StateMachineConfig {
  timeout?: number;
  maxRetries?: number;
}

/**
 * ConversationStateMachine
 * Manages state transitions and operation lifecycle
 */
export class ConversationStateMachine {
  private state: ConversationState = ConversationState.IDLE;
  private previousState: ConversationState = ConversationState.IDLE;
  private currentOperation: ConversationOperation | null = null;
  private error: ConversationError | null = null;
  private retryCount = 0;
  private maxRetries: number;
  private timeout: number;
  private listeners: Set<(state: ConversationState) => void> = new Set();

  constructor(config: StateMachineConfig = {}) {
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.state;
  }

  /**
   * Get previous state
   */
  getPreviousState(): ConversationState {
    return this.previousState;
  }

  /**
   * Get current operation
   */
  getCurrentOperation(): ConversationOperation | null {
    return this.currentOperation;
  }

  /**
   * Get current error
   */
  getError(): ConversationError | null {
    return this.error;
  }

  /**
   * Transition to a new state
   * Validates transition and cleans up previous operation if needed
   */
  async transitionTo(newState: ConversationState): Promise<boolean> {
    // Check if transition is valid
    if (!isValidTransition(this.state, newState)) {
      console.warn(
        `Invalid state transition: ${this.state} -> ${newState}. Valid transitions: ${VALID_TRANSITIONS[this.state].join(', ')}`
      );
      return false;
    }

    // Clean up previous operation if transitioning away from it
    if (newState !== ConversationState.RETRYING && newState !== ConversationState.ERROR) {
      await this.cancelCurrentOperation();
    }

    // Update state
    this.previousState = this.state;
    this.state = newState;

    // Reset error on transition to non-error states
    if (newState !== ConversationState.ERROR && newState !== ConversationState.RETRYING) {
      this.error = null;
    }

    // Reset retry count on successful transitions
    if (newState === ConversationState.LISTENING || newState === ConversationState.IDLE) {
      this.retryCount = 0;
    }

    // Notify listeners
    this.notifyListeners();

    return true;
  }

  /**
   * Start a new operation
   * Cancels any existing operation and creates a new one
   */
  startOperation(type: ConversationOperation['type']): AbortController {
    // Cancel existing operation
    if (this.currentOperation) {
      this.cancelCurrentOperation();
    }

    const controller = new AbortController();
    const operationId = createLocalId('operation');

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.handleOperationTimeout(operationId);
    }, this.timeout) as unknown as NodeJS.Timeout;

    this.currentOperation = {
      id: operationId,
      type,
      startTime: Date.now(),
      controller,
      timeout: timeoutId,
    };

    return controller;
  }

  /**
   * Complete current operation
   */
  completeOperation(): void {
    if (this.currentOperation) {
      if (this.currentOperation.timeout) {
        clearTimeout(this.currentOperation.timeout);
      }
      this.currentOperation = null;
    }
  }

  /**
   * Cancel current operation
   */
  async cancelCurrentOperation(): Promise<void> {
    if (this.currentOperation) {
      if (this.currentOperation.timeout) {
        clearTimeout(this.currentOperation.timeout);
      }
      this.currentOperation.controller.abort();
      this.currentOperation = null;
    }
  }

  /**
   * Set error state
   */
  setError(code: ConversationErrorCode, message: string, recoverable: boolean, details?: Record<string, unknown>): void {
    this.error = {
      code,
      message,
      timestamp: Date.now(),
      recoverable,
      details,
    };

    this.notifyListeners();
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.error = null;
  }

  /**
   * Increment retry count
   */
  incrementRetry(): void {
    this.retryCount++;
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Check if can retry
   */
  canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  /**
   * Reset retry count
   */
  resetRetry(): void {
    this.retryCount = 0;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ConversationState) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get store snapshot for Zustand
   */
  getSnapshot(): Partial<ConversationStore> {
    return {
      state: this.state,
      previousState: this.previousState,
      currentOperation: this.currentOperation,
      error: this.error,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
    };
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.cancelCurrentOperation();
    this.state = ConversationState.IDLE;
    this.previousState = ConversationState.IDLE;
    this.error = null;
    this.retryCount = 0;
    this.notifyListeners();
  }

  /**
   * Handle operation timeout
   */
  private handleOperationTimeout(operationId: string): void {
    if (this.currentOperation && this.currentOperation.id === operationId) {
      this.setError(
        ConversationErrorCode.TIMEOUT,
        'Operation timed out',
        true,
        { operationId, operationType: this.currentOperation.type }
      );
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }
}

/**
 * Create a new state machine instance
 */
export function createStateMachine(config?: StateMachineConfig): ConversationStateMachine {
  return new ConversationStateMachine(config);
}
