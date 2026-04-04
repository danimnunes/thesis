import { ProblemDetailsError } from "./ProblemDetailsError.ts";

/**
 * PreconditionRequiredError defines the Precondition Required (428) error type.
 */

export class PreconditionRequiredError extends ProblemDetailsError {
  static defaultTitle = "Precondition Required";

  static statusCode = 428;

  /**
   * @param title A short, human-readable summary of the problem type. It SHOULD NOT change from occurrence to occurrence of the problem, except for purposes of localization.
   * @param options An object containing optional properties.
   * @param options.type A URI reference that identifies the problem type. This specification encourages that, when dereferenced, it provides human-readable documentation for the problem type. When this member is not present, its value is assumed to be "about:blank".
   * @param options.detail A human-readable explanation specific to this occurrence of the problem.
   * @param options.instance A URI reference that identifies the specific occurrence of the problem. It may or may not yield further information if dereferenced.
   * @param options.extensions Extension members. See https://tools.ietf.org/html/rfc7807#section-3.2
   */
  constructor(
    title: string = PreconditionRequiredError.defaultTitle,
    options?: {
      detail?: string;
      extensions?: Record<string, unknown>;
      instance?: string;
      type?: string;
    },
  ) {
    super(PreconditionRequiredError.statusCode, title, options);
    this.name = "PreconditionRequiredError";
  }
}
