import { ProblemDetailsError } from "./ProblemDetailsError.ts";

export const HTTP_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * MethodNotAllowedError defines the Method Not Allowed (405) error type.
 */

export class MethodNotAllowedError extends ProblemDetailsError {
  static defaultTitle = "Method Not Allowed";

  static statusCode = 405;

  /**
   * @param title A short, human-readable summary of the problem type. It SHOULD NOT change from occurrence to occurrence of the problem, except for purposes of localization.
   * @param allow The HTTP methods allowed for the requested resource.
   * @param options An object containing optional properties.
   * @param options.type A URI reference that identifies the problem type. This specification encourages that, when dereferenced, it provides human-readable documentation for the problem type. When this member is not present, its value is assumed to be "about:blank".
   * @param options.detail A human-readable explanation specific to this occurrence of the problem.
   * @param options.instance A URI reference that identifies the specific occurrence of the problem. It may or may not yield further information if dereferenced.
   * @param options.extensions Extension members. See https://tools.ietf.org/html/rfc7807#section-3.2
   */
  constructor(
    title: string,
    allow: HttpMethod[],
    options?: {
      detail?: string;
      extensions?: Record<string, unknown>;
      instance?: string;
      type?: string;
    },
  ) {
    super(MethodNotAllowedError.statusCode, title, options);
    this.name = "MethodNotAllowedError";
    this.headers = {
      Allow: allow.join(", "),
    };
  }
}
