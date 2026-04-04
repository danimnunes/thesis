export type ValidationResult =
  | {
      error: string;
      success: false;
    }
  | {
      success: true;
    };
