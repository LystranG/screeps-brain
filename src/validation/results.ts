export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

export interface ValidationFailure {
  ok: false;
  reason: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;
