/**
 * Generic OAuth2 Error
 */
export type OAuth2ErrorCode =
  /**
   * The request is missing a required parameter, includes an unsupported parameter value (other
   * than grant type), repeats a parameter, includes multiple credentials, utilizes more than one
   * mechanism for authenticating the client, or is otherwise malformed.
   */
  | "invalid_request"
  /**
   * The authorization server encountered an unexpected condition that prevented it from fulfilling
   * the request. (This error code is needed because a 500 Internal Server Error HTTP status code
   * cannot be returned to the client via an HTTP redirect.)
   */
  | "server_error";

export interface OAuth2ErrorOptions {
  errorDescription?: string;
  errorUri?: string;
  statusCode?: number;
}

export class OAuth2Error<T extends string = OAuth2ErrorCode> extends Error {
  /**
   * REQUIRED.  A single ASCII error code.
   *
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A.7
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-4.1.2.1
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2.2.1
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-5.2
   */
  error: T;

  /**
   * OPTIONAL. Human-readable ASCII [USASCII] text providing additional information, used to assist
   * the client developer in understanding the error that occurred. Values for the
   * "error_description" parameter MUST NOT include characters outside the set
   * %x20-21 / %x23-5B / %x5D-7E.

   * @see https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A.8
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-4.1.2.1
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2.2.1
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-5.2
   */
  errorDescription: string | undefined;

  /**
   * OPTIONAL. A URI identifying a human-readable web page with information about the error, used
   * to provide the client developer with additional information about the error. Values for the
   * "error_uri" parameter MUST conform to the URI-reference syntax and thus MUST NOT include
   * characters outside the set %x21 / %x23-5B / %x5D-7E.
   *
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A.9
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-4.1.2.1
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2.2.1
   * @see https://www.rfc-editor.org/rfc/rfc6749.html#section-5.2
   */
  errorUri: string | undefined;

  // HTTP status code (default: 400)
  statusCode: number;

  constructor(errorCode: T, options?: OAuth2ErrorOptions) {
    super(options?.errorDescription);
    this.name = "OAuth2Error";
    this.error = errorCode;
    this.errorDescription = options?.errorDescription;
    this.errorUri = options?.errorUri;
    this.statusCode = options?.statusCode ?? 400;
  }

  toJSON() {
    return {
      error: this.error,
      ...(this.errorDescription && {
        error_description: this.errorDescription,
      }),
      ...(this.errorUri && { error_uri: this.errorUri }),
    };
  }

  override toString(): string {
    return `${this.name} - ${this.error}`;
  }
}
